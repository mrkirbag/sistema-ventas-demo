import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {

        const creditos = await db.execute(  `SELECT
                                            c.id AS id_credito,
                                            c.saldo_pendiente,
                                            v.id AS id_venta,
                                            v.fecha,
                                            v.total,
                                            v.estado,
                                            v.tipo_pago,
                                            cli.id AS id_cliente,
                                            cli.nombre,
                                            cli.cedula
                                            FROM creditos c
                                            JOIN ventas v ON c.id_venta = v.id
                                            JOIN clientes cli ON v.cliente_id = cli.id
                                            WHERE v.estado = 'pendiente';
                                        `);

        // Si no hay creditos, retornar un mensaje de error
        if (!creditos || !creditos.rows || creditos.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay creditos registrados' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202
            });
        }
        
        // Retornar los creditos en formato JSON
        return new Response(JSON.stringify(creditos.rows), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching creditos:', error);
        return new Response('Error fetching creditos', { status: 500 });
    }
}