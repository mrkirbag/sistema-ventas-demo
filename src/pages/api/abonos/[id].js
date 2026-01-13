import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request, params }) {
    
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const { id } = params;

        const creditoResult = await db.execute(`
                                                SELECT fecha, monto
                                                FROM abonos_credito
                                                WHERE id_credito = ?
                                                `, [id]);

        if (creditoResult.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No se han registrado abonos para esta venta a crédito' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202
            });
        }

        return new Response(JSON.stringify(creditoResult.rows), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error interno al consultar crédito/venta:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}