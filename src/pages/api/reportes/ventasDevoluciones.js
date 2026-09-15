import { db } from '../db.js';
import { verificarToken } from '@/utils/auth';

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * GET /api/reportes/ventasDevoluciones?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * Reporte de devoluciones en un rango de fechas.
 */
export async function GET({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403, headers: jsonHeaders });
    }

    const url = new URL(request.url);
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');

    if (!desde || !hasta) {
        return new Response(JSON.stringify({ error: 'Fechas inválidas' }), { status: 400, headers: jsonHeaders });
    }

    if (hasta < desde) {
        return new Response(JSON.stringify({ error: 'Rango de fechas inválido' }), { status: 400, headers: jsonHeaders });
    }

    try {
        // Detalle de devoluciones
        const devoluciones = await db.execute(
            `SELECT
                d.id,
                d.id_venta,
                d.monto_total,
                d.tipo_resolucion,
                d.saldo_disponible,
                d.motivo,
                d.fecha_creacion,
                c.nombre AS cliente_nombre,
                c.cedula AS cliente_cedula
            FROM devoluciones d
            JOIN clientes c ON c.id = d.cliente_id
            WHERE DATE(d.fecha_creacion) BETWEEN ? AND ?
            ORDER BY d.fecha_creacion DESC`,
            [desde, hasta]
        );

        // Resumen
        const resumen = await db.execute(
            `SELECT
                COUNT(*)                AS total_devoluciones,
                COALESCE(SUM(monto_total), 0)       AS monto_total_devuelto,
                COALESCE(SUM(CASE WHEN tipo_resolucion = 'EFECTIVO' THEN monto_total ELSE 0 END), 0) AS total_efectivo,
                COALESCE(SUM(CASE WHEN tipo_resolucion = 'NOTA_CREDITO' THEN monto_total ELSE 0 END), 0) AS total_notas_credito,
                COALESCE(SUM(CASE WHEN tipo_resolucion = 'NOTA_CREDITO' THEN saldo_disponible ELSE 0 END), 0) AS saldo_notas_pendiente
            FROM devoluciones
            WHERE DATE(fecha_creacion) BETWEEN ? AND ?`,
            [desde, hasta]
        );

        return new Response(JSON.stringify({
            resumen: resumen.rows[0] || {},
            devoluciones: devoluciones.rows,
        }), { headers: jsonHeaders });

    } catch (err) {
        console.error('Error en reporte de devoluciones:', err);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: jsonHeaders });
    }
}
