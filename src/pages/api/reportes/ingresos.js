import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }   
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
    }

    const url = new URL(request.url);
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');

    if (!desde || !hasta) {
        return new Response(JSON.stringify({ error: 'Fechas inválidas' }), { status: 400 });
    }
    if (hasta < desde) {
        return new Response(JSON.stringify({ error: 'Rango de fechas inválido' }), { status: 400 });
    }

    try {

        const ventasContado = await db.execute(
            `SELECT COUNT(*) AS ventas_contado, SUM(total) AS total_contado
                FROM ventas
                WHERE tipo_pago = 'contado'
                AND estado IN ('completado')
                AND DATE(fecha) BETWEEN ? AND ?
            `,[desde, hasta]
        );

        const ventasCredito = await db.execute(
            `SELECT COUNT(*) AS ventas_credito, SUM(total) AS total_credito
                FROM ventas
                WHERE tipo_pago = 'credito'
                AND estado IN ('completado', 'pendiente')
                AND DATE(fecha) BETWEEN ? AND ?
            `,[desde, hasta]
        );

        const abonos = await db.execute(
            `SELECT COUNT(*) AS abonos_realizados, SUM(monto) AS total_abonos
                FROM abonos_credito
                WHERE DATE(fecha) BETWEEN ? AND ?
            `,[desde, hasta]
        );

        const ganancia = await db.execute(
            `SELECT SUM((dv.precio_unitario - p.costo) * dv.cantidad) AS ganancia_neta
                FROM detalle_venta dv
                JOIN productos p ON p.codigo = dv.codigo_producto
                JOIN ventas v ON v.id = dv.id_venta
                WHERE v.tipo_pago = 'contado'
                AND v.estado = 'completado'
                AND DATE(v.fecha) BETWEEN ? AND ?
            `,[desde, hasta]
        );

        // Respuesta estructurada
        const ventasContadoRow = ventasContado.rows[0];
        const ventasCreditoRow = ventasCredito.rows[0];
        const abonosRow = abonos.rows[0];
        const gananciaRow = ganancia.rows[0];

        const total_ventas_contado = ventasContadoRow?.total_contado || 0;
        const total_ventas_credito = ventasCreditoRow?.total_credito || 0;
        const total_abonos_realizados = abonosRow?.total_abonos || 0;
        const total_en_caja = total_ventas_contado + total_abonos_realizados;

        return new Response(JSON.stringify({
            resumen: {
                ventas_contado: ventasContadoRow?.ventas_contado || 0,
                total_ventas_contado,
                margen_ganancia: gananciaRow?.ganancia_neta || 0,
                ventas_credito: ventasCreditoRow?.ventas_credito || 0,
                total_ventas_credito,
                abonos_realizados: abonosRow?.abonos_realizados || 0,
                total_abonos_realizados,
                total_en_caja
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Error en resumen de caja:', err);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
