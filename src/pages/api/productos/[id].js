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

        // Si no hay clientes, retornar un mensaje de error
        if (!producto || !producto.rows || producto.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay producto con ese ID' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404
            });
        }
        
        // Retornar los clientes en formato JSON
        return new Response(JSON.stringify(producto.rows[0]), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error fetching producto:', error);
        return new Response('Error fetching producto', { status: 500 });
    }
}