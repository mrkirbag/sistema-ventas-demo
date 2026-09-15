import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request, params }) {

    // Verificar autenticación
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    } 

    try {
        const { id } = params;
        const producto = await db.execute('SELECT * FROM productos WHERE id = ?', [id]);

        // Si no hay producto, retornar un mensaje de error
        if (!producto || !producto.rows || producto.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay producto con ese ID' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404
            });
        }
        
        const data = producto.rows[0];

        // Obtener seriales disponibles para este producto
        const seriales = await db.execute('SELECT serial FROM seriales WHERE producto_id = ? AND estado = "disponible"', [id]);
        data.serialesDisponibles = seriales.rows ? seriales.rows.map(r => r.serial) : [];

        // Determinar si el producto usa seriales (si tiene algún registro en la tabla de seriales, histórico o actual)
        const usaSerialesRes = await db.execute('SELECT 1 FROM seriales WHERE producto_id = ? LIMIT 1', [id]);
        data.usaSeriales = (usaSerialesRes.rows && usaSerialesRes.rows.length > 0);
        
        // Retornar el producto en formato JSON
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error fetching producto:', error);
        return new Response('Error fetching producto', { status: 500 });
    }
}