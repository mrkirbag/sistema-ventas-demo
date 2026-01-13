import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response('Forbidden', { status: 403 });
    }

    try {

        const query = 'SELECT * FROM cargas_productos ORDER BY fecha DESC';
        const cargas = await db.execute(query);

        // Si no hay cargas, retornar un mensaje de error
        if (!cargas || !cargas.rows || cargas.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay cargas registradas' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202
            });
        }
        
        // Retornar las cargas en formato JSON
        return new Response(JSON.stringify(cargas.rows), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching cargas:', error);
        return new Response('Error fetching cargas', { status: 500 });
    }
}