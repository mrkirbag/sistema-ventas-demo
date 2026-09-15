import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const fecha = url.searchParams.get('fecha');

        const result = await db.execute(` SELECT
                                            v.id,
                                            v.fecha,
                                            v.cliente_id,
                                            c.nombre AS cliente,
                                            c.cedula AS cedula_cliente,
                                            v.total,
                                            v.estado,
                                            v.tipo_pago
                                            FROM ventas v
                                            JOIN clientes c ON v.cliente_id = c.id
                                            WHERE v.fecha = ?
                                            AND v.estado != 'cancelado'
                                            AND v.tipo_pago != 'pendiente de seleccion'
                                            ORDER BY c.nombre ASC;
                                        `, [fecha]);

        if (!result || !result.rows || result.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay ventas registradas para esa fecha' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202
            });
        }

        return new Response(JSON.stringify(result.rows), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching ventas:', error);
        return new Response('Error fetching ventas', { status: 500 });
    }
}
