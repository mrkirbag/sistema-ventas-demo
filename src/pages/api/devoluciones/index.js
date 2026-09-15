import { db } from '../db.js';
import { verificarToken } from '@/utils/auth';
import { withTransaction, executeInTx } from '@/utils/dbTransaction';
import { ACCIONES, registrarBitacoraEnTx } from '@/utils/bitacora.js';
import { fechaHoraVenezuela } from '@/utils/helpers/formateoFecha.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * GET /api/devoluciones?fecha=YYYY-MM-DD
 * Lista las devoluciones de una fecha dada.
 */
export async function GET({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    const url = new URL(request.url);
    const fecha = url.searchParams.get('fecha');

    if (!fecha) {
        return new Response(JSON.stringify({ error: 'Se requiere el parámetro fecha' }), { status: 400, headers: jsonHeaders });
    }

    try {
        const result = await db.execute(
            `SELECT
                d.id,
                d.id_venta,
                d.monto_total,
                d.tipo_resolucion,
                d.saldo_disponible,
                d.motivo,
                d.fecha_creacion,
                c.nombre  AS cliente_nombre,
                c.cedula  AS cliente_cedula
            FROM devoluciones d
            JOIN clientes c ON c.id = d.cliente_id
            WHERE DATE(d.fecha_creacion) = ?
            ORDER BY d.fecha_creacion DESC`,
            [fecha]
        );

        if (result.rows.length === 0) {
            return new Response(JSON.stringify([]), { status: 202, headers: jsonHeaders });
        }

        return new Response(JSON.stringify(result.rows), { headers: jsonHeaders });
    } catch (err) {
        console.error('Error listando devoluciones:', err);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: jsonHeaders });
    }
}

/**
 * POST /api/devoluciones
 * Crea una devolución inmutable.
 *
 * Body: {
 *   id_venta: number,
 *   cliente_id: number,
 *   items_devueltos: [{ producto_id, codigo, nombre, precio, cantidad }],
 *   tipo_resolucion: 'EFECTIVO' | 'NOTA_CREDITO',
 *   motivo?: string
 * }
 */
export async function POST({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Solo administradores pueden procesar devoluciones' }), { status: 403, headers: jsonHeaders });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Body JSON inválido' }), { status: 400, headers: jsonHeaders });
    }

    const { id_venta, cliente_id, items_devueltos, tipo_resolucion, motivo } = body;

    // ── Validaciones de entrada ──────────────────────────────────────────
    if (!id_venta ) {
        return new Response(JSON.stringify({ error: 'ID de venta inválido' }), { status: 400, headers: jsonHeaders });
    }

    if (!cliente_id ) {
        return new Response(JSON.stringify({ error: 'ID de cliente inválido' }), { status: 400, headers: jsonHeaders });
    }

    if (!Array.isArray(items_devueltos) || items_devueltos.length === 0) {
        return new Response(JSON.stringify({ error: 'Debe incluir al menos un producto a devolver' }), { status: 400, headers: jsonHeaders });
    }

    if (!['EFECTIVO', 'NOTA_CREDITO'].includes(tipo_resolucion)) {
        return new Response(JSON.stringify({ error: 'Tipo de resolución inválido. Debe ser EFECTIVO o NOTA_CREDITO' }), { status: 400, headers: jsonHeaders });
    }

    for (const item of items_devueltos) {
        if (!item.producto_id || !item.codigo || !item.nombre || item.precio == null || item.cantidad == null) {
            return new Response(JSON.stringify({ error: `Datos incompletos para producto ${item.codigo || '(desconocido)'}` }), { status: 400, headers: jsonHeaders });
        }
        if (Number(item.cantidad) <= 0) {
            return new Response(JSON.stringify({ error: `Cantidad inválida para producto ${item.codigo}` }), { status: 400, headers: jsonHeaders });
        }
    }

    try {
        const devolucionId = crypto.randomUUID();

        await withTransaction(db, async (tx) => {

            // ── 1. Validar la venta ──────────────────────────────────────
            const ventaCheck = await executeInTx(
                tx,
                'SELECT id, estado, tipo_pago, cliente_id, total FROM ventas WHERE id = ?',
                [id_venta]
            );

            if (!ventaCheck.rows?.length) {
                throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
            }

            const venta = ventaCheck.rows[0];

            if (venta.estado === 'anulado') {
                throw Object.assign(new Error('No se puede devolver una venta anulada'), { status: 409 });
            }

            if (venta.estado === 'devuelto') {
                throw Object.assign(new Error('Esta venta ya fue devuelta'), { status: 409 });
            }

            // Verificar que el cliente_id coincide
            if (String(venta.cliente_id) !== String(cliente_id)) {
                throw Object.assign(new Error('El cliente no coincide con la venta'), { status: 400 });
            }

            // ── 2. Validar que los items pertenecen a la venta ───────────
            const detalleVenta = await executeInTx(
                tx,
                'SELECT producto_id, codigo_producto, nombre_producto, precio_unitario, cantidad FROM detalle_venta WHERE id_venta = ?',
                [id_venta]
            );

            const detalleMap = new Map();
            for (const row of detalleVenta.rows) {
                const key = row.producto_id;
                const existing = detalleMap.get(key) || 0;
                detalleMap.set(key, existing + Number(row.cantidad));
            }

            for (const item of items_devueltos) {
                const productoId = item.producto_id;
                const cantidadVendida = detalleMap.get(productoId);

                if (cantidadVendida == null) {
                    throw Object.assign(
                        new Error(`El producto ${item.codigo} no pertenece a esta venta`),
                        { status: 400 }
                    );
                }

                if (Number(item.cantidad) > cantidadVendida) {
                    throw Object.assign(
                        new Error(`Cantidad a devolver de ${item.codigo} (${item.cantidad}) excede lo vendido (${cantidadVendida})`),
                        { status: 400 }
                    );
                }
            }

            // ── 3. Calcular monto total devuelto ─────────────────────────
            const montoTotal = items_devueltos.reduce(
                (acc, item) => acc + (Number(item.precio) * Number(item.cantidad)),
                0
            );

            if (montoTotal <= 0) {
                throw Object.assign(new Error('El monto total de la devolución debe ser mayor a cero'), { status: 400 });
            }

            // ── 4. Actualizar estado de la venta (INMUTABLE: no borra el total) ──
            await executeInTx(
                tx,
                'UPDATE ventas SET estado = ? WHERE id = ?',
                ['devuelto', id_venta]
            );

            // ── 5. Si es crédito, manejar saldo pendiente ───────────────
            if (venta.tipo_pago === 'credito') {
                const credito = await executeInTx(
                    tx,
                    'SELECT id, saldo_pendiente FROM creditos WHERE id_venta = ?',
                    [id_venta]
                );

                if (credito.rows?.length) {
                    await executeInTx(
                        tx,
                        'UPDATE creditos SET saldo_pendiente = 0 WHERE id = ?',
                        [credito.rows[0].id]
                    );
                }
            }

            // ── 6. Devolver stock de productos e historial ───────────────────────────
            const { fecha, hora } = fechaHoraVenezuela();
            const usuarioNombre = usuario.nombre || usuario.usuario || 'Usuario';

            for (const item of items_devueltos) {
                const productoId = item.producto_id;
                const cantidadDevuelta = Number(item.cantidad);

                // Obtener stock actual
                const prodQuery = await executeInTx(tx, 'SELECT stock FROM productos WHERE id = ?', [productoId]);
                const stockAntes = Number(prodQuery.rows[0]?.stock || 0);
                const stockDespues = Math.round((stockAntes + cantidadDevuelta) * 1000) / 1000;

                // Actualizar stock
                await executeInTx(tx, 'UPDATE productos SET stock = ? WHERE id = ?', [stockDespues, productoId]);

                // Restaurar seriales vendidos
                const serialesVendidos = await executeInTx(
                    tx,
                    'SELECT id FROM seriales WHERE id_venta = ? AND producto_id = ? AND estado = ? LIMIT ?',
                    [id_venta, productoId, 'vendido', cantidadDevuelta]
                );

                if (serialesVendidos.rows && serialesVendidos.rows.length > 0) {
                    for (const row of serialesVendidos.rows) {
                        await executeInTx(
                            tx,
                            'UPDATE seriales SET estado = ?, id_venta = NULL WHERE id = ?',
                            ['disponible', row.id]
                        );
                    }
                }

                // Insertar movimiento
                await executeInTx(
                    tx,
                    `INSERT INTO movimientos_inventario (
                        producto_id, codigo_producto, nombre_producto, tipo, cantidad,
                        stock_antes, stock_despues, motivo, usuario_id, usuario_nombre, fecha, hora
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        productoId,
                        item.codigo,
                        item.nombre,
                        'entrada',
                        cantidadDevuelta,
                        stockAntes,
                        stockDespues,
                        `Devolución de venta #${id_venta}`,
                        usuario.id,
                        usuarioNombre,
                        fecha,
                        hora,
                    ]
                );

                // Registrar en bitácora el ingreso de inventario
                await registrarBitacoraEnTx(tx, {
                    usuario,
                    accion: ACCIONES.STOCK_ENTRADA,
                    entidad: 'productos',
                    entidadId: productoId,
                    detalle: `${item.codigo} — ${item.nombre} · entrada ${cantidadDevuelta} · stock ${stockAntes} → ${stockDespues} · Devolución de venta #${id_venta}`,
                });
            }

            // ── 7. Insertar cabecera de devolución ───────────────────────
            const saldoDisponible = tipo_resolucion === 'NOTA_CREDITO' ? montoTotal : 0;

            await executeInTx(
                tx,
                `INSERT INTO devoluciones (id, id_venta, cliente_id, monto_total, tipo_resolucion, saldo_disponible, motivo)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [devolucionId, id_venta, cliente_id, montoTotal, tipo_resolucion, saldoDisponible, motivo || '']
            );

            // ── 8. Insertar detalle de devolución ────────────────────────
            for (const item of items_devueltos) {
                await executeInTx(
                    tx,
                    `INSERT INTO detalle_devolucion (id_devolucion, producto_id, codigo_producto, nombre_producto, precio_unitario, cantidad)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [devolucionId, item.producto_id, item.codigo, item.nombre, Number(item.precio), Number(item.cantidad)]
                );
            }

            // ── 9. Registrar en bitácora ─────────────────────────────────
            const tipoTexto = tipo_resolucion === 'NOTA_CREDITO' ? 'Nota de crédito' : 'Reembolso en efectivo';
            await registrarBitacoraEnTx(tx, {
                usuario,
                accion: ACCIONES.DEVOLUCION,
                entidad: 'devoluciones',
                entidadId: null,
                detalle: `Devolución de Venta #${id_venta} · ${tipoTexto} · $${montoTotal.toFixed(2)} · ID: ${devolucionId}`,
            });
        });

        return new Response(JSON.stringify({
            message: 'Devolución procesada correctamente',
            devolucionId,
        }), { status: 201, headers: jsonHeaders });

    } catch (err) {
        const status = err.status ?? 500;
        const message = status === 500 ? 'Error interno del servidor' : err.message;

        if (status === 500) {
            console.error('Error procesando devolución:', err);
        }

        return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
    }
}
