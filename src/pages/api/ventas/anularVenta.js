import { db } from '../db.js'; 
import { verificarToken } from '@/utils/auth';

export async function POST({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || isNaN(Number(id))) {
        return new Response(JSON.stringify({ error: 'ID inválido' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
        });
    }

    try {

        //Validar que la venta exista y que no este anulada
        const ventaCheck = await db.execute('SELECT estado FROM ventas WHERE id = ?',[id]);
        const validarVenta = ventaCheck.rows[0];

        if (!ventaCheck.rows || ventaCheck.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'Venta no encontrada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (validarVenta.estado === 'anulado') {
            return new Response(JSON.stringify({ message: 'Venta ya está anulada' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Anular la venta
        await db.execute('UPDATE ventas SET estado = ? WHERE id = ?',['anulado', id]);

        // Obtener productos del detalle
        const productos = await db.execute('SELECT codigo_producto, cantidad FROM detalle_venta WHERE id_venta = ?',[id]);
        const productoArray = productos.rows;

        // Devolver unidades 
        for (const { codigo_producto, cantidad } of productoArray) {
            await db.execute('UPDATE productos SET stock = stock + ? WHERE codigo = ?',[cantidad, codigo_producto]);
        }

        return new Response(JSON.stringify({ message: 'Venta anulada correctamente' }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}