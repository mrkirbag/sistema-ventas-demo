import { db } from '../db.js';
import { verificarToken } from '@/utils/auth';

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * GET /api/devoluciones/notasCredito?cliente_id=5
 * Obtiene las notas de crédito activas (saldo_disponible > 0) de un cliente.
 * Devuelve el saldo total acumulado y el desglose por nota (FIFO por fecha).
 */
export async function GET({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    const url = new URL(request.url);
    const clienteId = url.searchParams.get('cliente_id');

    if (!clienteId ) {
        return new Response(JSON.stringify({ error: 'ID de cliente inválido' }), { status: 400, headers: jsonHeaders });
    }

    try {
        // Saldo total acumulado del cliente
        const totalResult = await db.execute(
            `SELECT COALESCE(SUM(saldo_disponible), 0) AS saldo_total
             FROM devoluciones
             WHERE cliente_id = ?
               AND tipo_resolucion = 'NOTA_CREDITO'
               AND saldo_disponible > 0`,
            [clienteId]
        );

        const saldoTotal = Number(totalResult.rows[0]?.saldo_total ?? 0);

        // Desglose FIFO (ordenado por fecha de creación)
        const notasResult = await db.execute(
            `SELECT
                id,
                id_venta,
                monto_total,
                saldo_disponible,
                fecha_creacion
             FROM devoluciones
             WHERE cliente_id = ?
               AND tipo_resolucion = 'NOTA_CREDITO'
               AND saldo_disponible > 0
             ORDER BY fecha_creacion ASC`,
            [clienteId]
        );

        return new Response(JSON.stringify({
            saldo_total: saldoTotal,
            notas: notasResult.rows,
        }), { headers: jsonHeaders });

    } catch (err) {
        console.error('Error obteniendo notas de crédito:', err);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: jsonHeaders });
    }
}
