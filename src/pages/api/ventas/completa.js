import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { withTransaction } from '@/utils/dbTransaction';
import {
    parsearItemVenta,
    verificarProductoDisponible,
    descontarStock,
    insertarDetalleVenta,
    normalizarId,
} from '@/utils/ventaValidaciones';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function POST({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {
        const body = await request.json();
        const { fecha, tipoPago, clienteId, totalDeVenta, productos } = body;

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

        const itemsParseados = [];
        for (const producto of productos) {
            const parsed = parsearItemVenta(producto);
            if (!parsed.ok) {
                return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: jsonHeaders });
            }
            itemsParseados.push(parsed.item);
        }

        const ventaId = await withTransaction(db, async (tx) => {
            const cliente = await tx.execute(
                'SELECT id FROM clientes WHERE id = ? AND estatus = "activo"',
                [clienteId]
            );

            if (!cliente.rows?.length) {
                throw Object.assign(new Error('Cliente no encontrado o inactivo'), { status: 404 });
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

            const ventaResult = await tx.execute(
                'INSERT INTO ventas (fecha, cliente_id, total, estado, tipo_pago) VALUES (?, ?, ?, ?, ?)',
                [fecha, clienteId, totalDeVenta, estado, tipoPago]
            );

            const idVenta = normalizarId(ventaResult.lastInsertRowid);

            if (tipoPago === 'credito') {
                await tx.execute(
                    'INSERT INTO creditos (id_venta, saldo_pendiente) VALUES (?, ?)',
                    [idVenta, totalDeVenta]
                );
            }

            for (const item of itemsParseados) {
                await insertarDetalleVenta(tx, idVenta, item);
                await descontarStock(tx, item.codigo, item.cantidad);
            }

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
