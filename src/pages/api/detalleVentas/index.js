import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { withTransaction } from '@/utils/dbTransaction';
import {
    parsearItemVenta,
    verificarProductoDisponible,
    descontarStock,
    insertarDetalleVenta,
} from '@/utils/ventaValidaciones';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {

        const url = new URL(request.url);
        const ventaId = parseInt(url.searchParams.get('ventaId'));

        const productosSeleccionados = await db.execute('SELECT * FROM detalle_venta WHERE id_venta = ?', [ventaId]);

        if (!productosSeleccionados || !productosSeleccionados.rows || productosSeleccionados.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay productos registrados para esa venta' }), {
                headers: jsonHeaders,
                status: 204
            });
        }
        
        return new Response(JSON.stringify(productosSeleccionados.rows), {
            headers: jsonHeaders,
        });

    } catch (error) {
        console.error('Error fetching products:', error);
        return new Response('Error fetching products', { status: 500 });
    }
}

export async function POST({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {

        const body = await request.json();
        const { ventaId, idProducto, codigo, nombre, precio, cantidad } = body;

        const parsed = parsearItemVenta({ idProducto, codigo, nombre, precio, cantidad });
        if (!parsed.ok) {
            return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: jsonHeaders });
        }

        if (!ventaId) {
            return new Response(JSON.stringify({ error: 'Falta el ID de la venta' }), { status: 400, headers: jsonHeaders });
        }

        const item = parsed.item;

        await withTransaction(db, async (tx) => {
            const venta = await tx.execute(
                'SELECT id, estado FROM ventas WHERE id = ?',
                [ventaId]
            );

            if (!venta.rows?.length) {
                throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
            }

            if (venta.rows[0].estado === 'anulado') {
                throw Object.assign(new Error('No se pueden agregar productos a una venta anulada'), { status: 409 });
            }

            const disponible = await verificarProductoDisponible(tx, item.codigo, item.cantidad);
            if (!disponible.ok) {
                throw Object.assign(new Error(disponible.error), { status: 409 });
            }

            await insertarDetalleVenta(tx, ventaId, item);
            await descontarStock(tx, item.codigo, item.cantidad);
        });

        return new Response(JSON.stringify({ message: 'Producto registrado exitosamente en la venta' }), {
            status: 201,
            headers: jsonHeaders,
        });

    } catch (error) {
        const status = error.status ?? 500;
        const message = status === 500 ? 'Error al registrar el producto en la venta' : error.message;

        if (status === 500) {
            console.error('Error inserting product:', error);
        }

        return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
    }
}
