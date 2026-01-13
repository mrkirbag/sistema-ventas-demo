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
                                                SELECT id_venta, saldo_pendiente
                                                FROM creditos
                                                WHERE id = ?
                                                `, [id]);

        if (creditoResult.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'Crédito no encontrado' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404
            });
        }

        const { id_venta, saldo_pendiente } = creditoResult.rows[0];

        // 2. Obtener datos de la venta y cliente
        const ventaResult = await db.execute(`
            SELECT
                v.id,
                v.total AS total_usd,
                v.fecha,
                v.tipo_pago,
                v.estado,
                cli.nombre AS nombre_cliente,
                cli.cedula AS cedula_cliente,
                cli.telefono AS telefono_cliente
            FROM ventas v
            JOIN clientes cli ON v.cliente_id = cli.id
            WHERE v.id = ?
        `, [id_venta]);

        if (ventaResult.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'Venta no encontrada' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404
            });
        }

        const ventaData = ventaResult.rows[0];

        // 3. Obtener productos de la venta
        const productosResult = await db.execute(`
            SELECT
                codigo_producto,
                nombre_producto,
                precio_unitario,
                cantidad,
                subtotal
            FROM detalle_venta
            WHERE id_venta = ?
            ORDER BY nombre_producto ASC
        `, [id_venta]);

        if (productosResult.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'Venta sin productos' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404
            });
        }

        // 4. Armar respuesta final
        const result = {
            credito: {
                saldo_pendiente,
                id_venta
            },
            cliente: {
                nombre: ventaData.nombre_cliente,
                cedula: ventaData.cedula_cliente,
                telefono: ventaData.telefono_cliente
            },
            venta: {
                fecha: ventaData.fecha,
                monto_total: ventaData.total_usd,
                tipo_pago: ventaData.tipo_pago,
                estado: ventaData.estado
            },
            productos: productosResult.rows
        };

        return new Response(JSON.stringify(result), {
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