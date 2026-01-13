import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }


    try {

        const query = `SELECT
                            c.nombre as cliente,
                            v.total
                        FROM ventas v
                        INNER JOIN clientes c ON v.cliente_id = c.id
                        WHERE v.estado IN ('pendiente', 'completado')
                        AND date(v.fecha) = date('now', '-4 hours')
                        ORDER BY v.fecha ASC
                        LIMIT 3;
                    `;

        const ventas = await db.execute(query);

        // Si no hay ventas, retornar un mensaje de error
        if (!ventas || !ventas.rows || ventas.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay ventas hoy' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202
            });
        }

        // Retornar las ventas en formato JSON
        return new Response(JSON.stringify(ventas.rows), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching cargas:', error);
        return new Response('Error fetching cargas', { status: 500 });
    }
}