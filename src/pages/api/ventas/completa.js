import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { executeInTx, withTransaction } from '@/utils/dbTransaction';
import {
    parsearItemVenta,
    verificarProductoDisponible,
    descontarStock,
    insertarDetalleVenta,
    normalizarId,
} from '@/utils/ventaValidaciones';
import { obtenerMonedaBase } from '@/utils/helpers/tasas.js';
import { validarPagosVenta } from '@/utils/helpers/metodosPago.js';
import { ACCIONES, registrarBitacoraEnTx } from '@/utils/bitacora.js';
import { fechaHoraVenezuela } from '@/utils/helpers/formateoFecha.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function tasasDelDia() {
    const result = await db.execute('SELECT valor, bs FROM tasa WHERE id = 1');
    const row = result.rows?.[0];
    return {
        cop: Number(row?.valor) || 0,
        bs: Number(row?.bs) || 0,
    };
}

function idClienteValido(valor) {
    if (!valor) return null;
    return String(valor).trim() || null;
}

export async function POST({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {
        const body = await request.json();
        const { fecha, tipoPago, totalDeVenta, productos, pagos } = body;
        const clienteId = idClienteValido(body.clienteId);

        if (!fecha || !clienteId || !tipoPago || totalDeVenta == null) {
            return new Response(JSON.stringify({ error: 'Faltan datos de la venta' }), { status: 400, headers: jsonHeaders });
        }

        if (!Array.isArray(productos) || productos.length === 0) {
            return new Response(JSON.stringify({ error: 'La venta debe incluir al menos un producto' }), { status: 400, headers: jsonHeaders });
        }

        if (totalDeVenta <= 0) {
            return new Response(JSON.stringify({ error: 'El total de la venta debe ser mayor a cero' }), { status: 400, headers: jsonHeaders });
        }

        if (tipoPago !== 'credito' && tipoPago !== 'contado') {
            return new Response(JSON.stringify({ error: 'Tipo de pago inválido' }), { status: 400, headers: jsonHeaders });
        }

        const tasas = await tasasDelDia();
        const pagosValidados = validarPagosVenta({
            tipoPago,
            pagos,
            totalBase: totalDeVenta,
            monedaBase: obtenerMonedaBase(),
            tasas,
        });

        if (!pagosValidados.ok) {
            return new Response(JSON.stringify({ error: pagosValidados.error }), { status: 400, headers: jsonHeaders });
        }

        const itemsParseados = [];
        for (const producto of productos) {
            const parsed = parsearItemVenta(producto);
            if (!parsed.ok) {
                return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: jsonHeaders });
            }
            itemsParseados.push(parsed.item);
        }

        const ventaId = await withTransaction(db, async (tx) => {
            const cliente = await executeInTx(
                tx,
                `SELECT id, estatus FROM clientes WHERE id = ?`,
                [clienteId]
            );

            const filaCliente = cliente.rows?.[0];
            if (!filaCliente) {
                throw Object.assign(new Error('Cliente no encontrado o inactivo'), { status: 404 });
            }

            const estatus = String(filaCliente.estatus || 'activo').toLowerCase();
            if (estatus === 'inactivo') {
                await executeInTx(
                    tx,
                    'UPDATE clientes SET estatus = ? WHERE id = ?',
                    ['activo', clienteId]
                );
            }

            const stockPorCodigo = new Map();
            for (const item of itemsParseados) {
                const acumulado = (stockPorCodigo.get(item.codigo) ?? 0) + parseFloat(item.cantidad);
                stockPorCodigo.set(item.codigo, acumulado);
            }

            for (const [codigo, cantidadTotal] of stockPorCodigo) {
                const disponible = await verificarProductoDisponible(tx, codigo, cantidadTotal);
                if (!disponible.ok) {
                    throw Object.assign(new Error(disponible.error), { status: 409 });
                }
            }

            const estado = tipoPago === 'credito' ? 'pendiente' : 'completado';

            const ventaResult = await executeInTx(
                tx,
                'INSERT INTO ventas (fecha, cliente_id, total, estado, tipo_pago) VALUES (?, ?, ?, ?, ?) RETURNING id',
                [fecha, clienteId, totalDeVenta, estado, tipoPago]
            );

            const idVenta = normalizarId(ventaResult.rows[0].id);

            if (tipoPago === 'credito') {
                await executeInTx(
                    tx,
                    'INSERT INTO creditos (id_venta, saldo_pendiente) VALUES (?, ?)',
                    [idVenta, totalDeVenta]
                );
            }

            for (const pago of pagosValidados.pagos) {
                await executeInTx(
                    tx,
                    `INSERT INTO pagos_venta
                        (id_venta, moneda, metodo, monto, monto_base, moneda_base, tasa_cop, tasa_bs)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        idVenta,
                        pago.moneda,
                        pago.metodo,
                        pago.monto,
                        pago.monto_base,
                        pago.moneda_base,
                        pago.tasa_cop,
                        pago.tasa_bs,
                    ]
                );

                if (pago.metodo === 'nota_credito') {
                    let restante = pago.monto_base;
                    const notasResult = await executeInTx(
                        tx,
                        `SELECT id, saldo_disponible
                         FROM devoluciones
                         WHERE cliente_id = ?
                           AND tipo_resolucion = 'NOTA_CREDITO'
                           AND saldo_disponible > 0
                         ORDER BY fecha_creacion ASC`,
                        [clienteId]
                    );

                    for (const nota of (notasResult.rows || [])) {
                        if (restante <= 0) break;
                        const saldoNota = Number(nota.saldo_disponible);
                        const consumir = Math.min(saldoNota, restante);
                        const nuevoSaldo = +(saldoNota - consumir).toFixed(2);
                        
                        await executeInTx(
                            tx,
                            'UPDATE devoluciones SET saldo_disponible = ? WHERE id = ?',
                            [nuevoSaldo, nota.id]
                        );
                        restante = +(restante - consumir).toFixed(2);
                    }

                    if (restante > 0.01) {
                        throw Object.assign(new Error(`El cliente no tiene saldo suficiente en notas de crédito (faltan ${restante.toFixed(2)} USD)`), { status: 400 });
                    }
                }
            }

            const { fecha: fechaMov, hora: horaMov } = fechaHoraVenezuela();
            const usuarioNombre = usuario.nombre || usuario.usuario || 'Usuario';

            for (const item of itemsParseados) {
                await insertarDetalleVenta(tx, idVenta, item);
                const { stockAntes, stockDespues } = await descontarStock(tx, item.codigo, item.cantidad);

                // Registrar el movimiento de salida
                await executeInTx(
                    tx,
                    `INSERT INTO movimientos_inventario (
                        producto_id, codigo_producto, nombre_producto, tipo, cantidad,
                        stock_antes, stock_despues, motivo, usuario_id, usuario_nombre, fecha, hora
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        item.productoId,
                        item.codigo,
                        item.nombre,
                        'salida',
                        item.cantidad,
                        stockAntes,
                        stockDespues,
                        `Venta #${idVenta}`,
                        usuario.id,
                        usuarioNombre,
                        fechaMov,
                        horaMov,
                    ]
                );
                
                if (item.seriales && item.seriales.length > 0) {
                    for (const serial of item.seriales) {
                        await executeInTx(tx, 
                            `UPDATE seriales SET estado = 'vendido', id_venta = ? WHERE serial = ? AND producto_id = ?`,
                            [idVenta, serial, item.productoId]
                        );
                    }
                }
            }

            await registrarBitacoraEnTx(tx, {
                usuario,
                accion: tipoPago === 'credito' ? ACCIONES.CREDITO : ACCIONES.VENTA,
                entidad: 'ventas',
                entidadId: idVenta,
                detalle: `Venta #${idVenta} · ${tipoPago} · total ${totalDeVenta}`,
            });

            return idVenta;
        });

        return new Response(
            JSON.stringify({ message: 'Venta registrada exitosamente', ventaId }),
            { status: 201, headers: jsonHeaders }
        );
    } catch (error) {
        const status = error.status ?? 500;
        const message = status === 500 ? 'Error al registrar la venta' : error.message;

        if (status === 500) {
            console.error('Error registrando venta completa:', error);
        }

        return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
    }
}
