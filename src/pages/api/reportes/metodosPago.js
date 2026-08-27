import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { etiquetaPago } from '@/utils/helpers/metodosPago.js';
import { etiquetaMoneda, obtenerMonedaBase } from '@/utils/helpers/tasas.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function GET({ request }) {
    const usuario = await verificarToken(request);
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
        const result = await db.execute(
            `SELECT
                p.moneda,
                p.metodo,
                p.moneda_base,
                COUNT(*) AS cantidad,
                SUM(p.monto) AS total_moneda,
                SUM(p.monto_base) AS total_base
             FROM pagos_venta p
             JOIN ventas v ON v.id = p.id_venta
             WHERE v.estado != 'anulado'
               AND DATE(v.fecha) BETWEEN ? AND ?
             GROUP BY p.moneda, p.metodo, p.moneda_base
             ORDER BY p.moneda ASC, p.metodo ASC`,
            [desde, hasta]
        );

        const monedaBase = obtenerMonedaBase();
        const filas = (result.rows || []).map((row) => ({
            moneda: row.moneda,
            metodo: row.metodo,
            moneda_base: row.moneda_base || monedaBase,
            etiqueta: etiquetaPago(row.moneda, row.metodo),
            etiqueta_moneda: etiquetaMoneda(row.moneda),
            cantidad: Number(row.cantidad) || 0,
            total_moneda: Number(row.total_moneda) || 0,
            total_base: Number(row.total_base) || 0,
        }));

        const total_base = filas.reduce((acc, fila) => acc + fila.total_base, 0);
        const por_moneda = {};

        for (const fila of filas) {
            if (!por_moneda[fila.moneda]) {
                por_moneda[fila.moneda] = {
                    moneda: fila.moneda,
                    etiqueta: fila.etiqueta_moneda,
                    total_moneda: 0,
                    total_base: 0,
                    metodos: [],
                };
            }
            por_moneda[fila.moneda].total_moneda += fila.total_moneda;
            por_moneda[fila.moneda].total_base += fila.total_base;
            por_moneda[fila.moneda].metodos.push(fila);
        }

        return new Response(JSON.stringify({
            moneda_base: monedaBase,
            total_base,
            metodos: filas,
            por_moneda,
        }), { status: 200, headers: jsonHeaders });
    } catch (error) {
        console.error('Error en reporte de métodos de pago:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: jsonHeaders });
    }
}
