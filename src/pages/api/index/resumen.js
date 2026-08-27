import { db } from '../db';
import { verificarToken } from '@/utils/auth';

const jsonHeaders = { 'Content-Type': 'application/json' };
const DIA_LOCAL = `date('now', '-4 hours')`;

export async function GET({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {
        const result = await db.execute(`
            SELECT
                (SELECT COUNT(*) FROM productos WHERE estatus = 'activo') AS productos_activos,
                (SELECT COUNT(*) FROM productos WHERE estatus = 'activo' AND stock = 0) AS agotados,
                (SELECT COUNT(*) FROM productos WHERE estatus = 'activo' AND stock > 0 AND stock <= 5) AS stock_bajo,
                (SELECT COUNT(*) FROM ventas
                    WHERE estado IN ('pendiente', 'completado')
                    AND date(fecha) = ${DIA_LOCAL}) AS ventas_hoy,
                (SELECT COALESCE(SUM(total), 0) FROM ventas
                    WHERE estado IN ('pendiente', 'completado')
                    AND date(fecha) = ${DIA_LOCAL}) AS total_hoy
        `);

        const row = result.rows?.[0] || {};

        return new Response(JSON.stringify({
            productosActivos: Number(row.productos_activos) || 0,
            agotados: Number(row.agotados) || 0,
            stockBajo: Number(row.stock_bajo) || 0,
            ventasHoy: Number(row.ventas_hoy) || 0,
            totalHoy: Number(row.total_hoy) || 0,
        }), { status: 200, headers: jsonHeaders });
    } catch (error) {
        console.error('Error en resumen del dashboard:', error);
        return new Response(JSON.stringify({ error: 'Error al cargar el resumen' }), { status: 500, headers: jsonHeaders });
    }
}
