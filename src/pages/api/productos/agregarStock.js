import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function PUT({ request }) {

    // Verificar autenticación
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    } 
    if (usuario.rol !== 'admin'){
        return new Response('No autorizado', { status: 403 });
    }

    try {

        const body = await request.json();
        const { id, stockNumero } = body;

        const producto = await db.execute('SELECT stock FROM productos WHERE id = ?', [id]);

        // Si no hay producto, retornar un mensaje de error
        if (!producto || !producto.rows || producto.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay producto con ese ID' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404
            });
        }
        
        const stockActual = producto.rows[0].stock;

        const stockActualNum = parseFloat(stockActual);
        const stockNuevoNum = parseFloat(stockNumero);

        console.log({ stockActualNum, stockNuevoNum });

        const stockTotal = stockActualNum + stockNuevoNum;

        await db.execute('UPDATE productos SET stock = ? WHERE id = ?', [stockTotal, id]);

        return new Response(JSON.stringify({ message: 'Stock actualizado correctamente', stock: stockTotal }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });


    } catch (error) {
        console.error('Error fetching producto:', error);
        return new Response('Error fetching producto', { status: 500 });
    }
}