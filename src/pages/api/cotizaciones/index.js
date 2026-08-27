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

        if (!fecha) {
            return new Response(JSON.stringify({ message: 'Fecha requerida' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        const result = await db.execute(
            `SELECT
                id,
                fecha,
                cliente_nombre,
                cliente_cedula_rif,
                cliente_telefono,
                cliente_direccion,
                total
             FROM cotizaciones
             WHERE fecha = ?
             ORDER BY cliente_nombre ASC`,
            [fecha]
        );

        if (!result?.rows?.length) {
            return new Response(JSON.stringify({ message: 'No hay cotizaciones registradas para esa fecha' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202,
            });
        }

        return new Response(JSON.stringify(result.rows.map((row) => ({
            ...row,
            total: parseFloat(row.total),
        }))), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching cotizaciones:', error);
        return new Response('Error fetching cotizaciones', { status: 500 });
    }
}
