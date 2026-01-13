import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request, params }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
    }

    try {

        const { id } = params;

        const carga = await db.execute(`SELECT * FROM cargas_productos WHERE id = ?`, [id]);

        // Validar si no hay resultados para ese id
        if (carga.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'Carga no encontrada' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 204
            });
        }

        const detalleCarga = await db.execute(`SELECT * FROM detalle_carga_productos WHERE id_carga = ? ORDER BY codigo_producto ASC`, [id]);
        
        // Validar si no hay productos en esa carga
        if (detalleCarga.rows.length === 0){
            return new Response(JSON.stringify({ message: 'Carga sin productos' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 204
            });
        }

        const result = {
                            fecha: carga.rows[0].fecha,
                            proveedor: carga.rows[0].proveedor,
                            monto_total: carga.rows[0].monto_total,
                            productos_agregados: carga.rows[0].productos_agregados,
                            detalles: detalleCarga.rows
        }

        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' }});

    } catch (error) {
        console.error('Error interno al consultar venta:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}