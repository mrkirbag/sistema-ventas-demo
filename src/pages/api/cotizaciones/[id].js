import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request, params }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const { id } = params;

        const cotizacionResult = await db.execute(
            `SELECT
                id,
                fecha,
                cliente_nombre,
                cliente_cedula_rif,
                cliente_telefono,
                cliente_direccion,
                total
             FROM cotizaciones
             WHERE id = ?`,
            [id]
        );

        if (!cotizacionResult.rows.length) {
            return new Response(JSON.stringify({ message: 'Cotización no encontrada' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202,
            });
        }

        const cotizacionData = cotizacionResult.rows[0];

        const productosResult = await db.execute(
            `SELECT
                codigo_producto,
                nombre_producto,
                precio_unitario,
                cantidad,
                subtotal
             FROM detalle_cotizacion
             WHERE id_cotizacion = ?
             ORDER BY nombre_producto ASC`,
            [id]
        );

        if (!productosResult.rows.length) {
            return new Response(JSON.stringify({ message: 'Cotización sin productos' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202,
            });
        }

        const result = {
            cliente: {
                nombre: cotizacionData.cliente_nombre,
                cedula_rif: cotizacionData.cliente_cedula_rif,
                telefono: cotizacionData.cliente_telefono,
                direccion: cotizacionData.cliente_direccion,
            },
            cotizacion: {
                id: cotizacionData.id,
                fecha: cotizacionData.fecha,
                monto_total: parseFloat(cotizacionData.total),
            },
            productos: productosResult.rows.map((producto) => ({
                codigo_producto: producto.codigo_producto,
                nombre_producto: producto.nombre_producto,
                precio_unitario: parseFloat(producto.precio_unitario),
                cantidad: parseFloat(producto.cantidad),
                subtotal: parseFloat(producto.subtotal),
            })),
        };

        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error interno al consultar cotización:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        });
    }
}
