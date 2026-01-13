import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }


    try {

        const query = "SELECT nombre, codigo, stock, unidad_medida FROM productos WHERE stock = 0 AND estatus = 'activo' ORDER BY nombre ASC LIMIT 3;";
        const agotados = await db.execute(query);

        // Si no hay productos agotados, retornar un mensaje de error
        if (!agotados || !agotados.rows || agotados.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay productos agotados' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202
            });
        }

        // Retornar los productos agotados en formato JSON
        return new Response(JSON.stringify(agotados.rows), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching cargas:', error);
        return new Response('Error fetching cargas', { status: 500 });
    }
}