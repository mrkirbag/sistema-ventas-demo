import { db } from '../db';
import { verificarToken } from '@/utils/auth';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function GET({ request, params }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403, headers: jsonHeaders });
    }

    try {
        const { id } = params;

        const compra = await db.execute(`SELECT * FROM compras WHERE id = ?`, [id]);

        if (compra.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'Compra no encontrada' }), {
                status: 204,
                headers: jsonHeaders
            });
        }

        const detalleCompra = await db.execute(`SELECT * FROM detalle_compra WHERE id_compra = ? ORDER BY codigo_producto ASC`, [id]);
        
        // Load serials
        const seriales = await db.execute(`SELECT * FROM seriales WHERE id_compra = ?`, [id]);

        // Merge serials into details
        const detallesConSeriales = detalleCompra.rows.map(detalle => {
            const serialesDelProducto = seriales.rows
                .filter(s => String(s.producto_id) === String(detalle.producto_id))
                .map(s => s.serial);
            
            return {
                ...detalle,
                seriales: serialesDelProducto
            };
        });

        const result = {
            id: compra.rows[0].id,
            fecha: compra.rows[0].fecha,
            proveedor: compra.rows[0].proveedor,
            monto_total: compra.rows[0].monto_total,
            detalles: detallesConSeriales
        };

        return new Response(JSON.stringify(result), { headers: jsonHeaders });

    } catch (error) {
        console.error('Error interno al consultar compra:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: jsonHeaders
        });
    }
}
