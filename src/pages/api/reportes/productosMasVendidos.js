import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if(usuario.rol !== 'admin') {
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

    const queryTop = `
                        SELECT 
                            vd.codigo_producto,
                            p.nombre AS nombre_producto,
                            SUM(vd.cantidad) AS cantidad_total,
                            SUM(vd.cantidad * vd.precio_unitario) AS total_usd
                        FROM detalle_venta vd
                        JOIN ventas v ON v.id = vd.id_venta
                        JOIN productos p ON p.codigo = vd.codigo_producto
                        WHERE v.estado IN ('completado', 'devuelto')
                            AND DATE(v.fecha) BETWEEN ? AND ?
                        GROUP BY vd.codigo_producto, p.nombre
                        ORDER BY cantidad_total DESC;
                    `;

    const queryBottom = `
                            SELECT 
                                vd.codigo_producto,
                                p.nombre AS nombre_producto,
                                SUM(vd.cantidad) AS cantidad_total,
                                SUM(vd.cantidad * vd.precio_unitario) AS total_usd
                            FROM detalle_venta vd
                            JOIN ventas v ON v.id = vd.id_venta
                            JOIN productos p ON p.codigo = vd.codigo_producto
                            WHERE v.estado IN ('completado', 'devuelto')
                                AND DATE(v.fecha) BETWEEN ? AND ?
                            GROUP BY vd.codigo_producto, p.nombre
                            ORDER BY cantidad_total ASC;
                        `;

    try {
        const [top, bottom] = await Promise.all([
            db.execute(queryTop, [desde, hasta]),
            db.execute(queryBottom, [desde, hasta])
        ]);

        const resultado = {
            mas_vendidos: top.rows,
            menos_vendidos: bottom.rows
        };

        return new Response(JSON.stringify(resultado), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Error en productosExtremos:', err);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}