import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { withTransaction } from '@/utils/dbTransaction';
import { normalizarId } from '@/utils/ventaValidaciones';

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const fecha = url.searchParams.get('fecha');

        const result = await db.execute(` SELECT
                                            v.id,
                                            v.fecha,
                                            c.nombre AS cliente,
                                            c.cedula AS cedula_cliente,
                                            v.total,
                                            v.estado,
                                            v.tipo_pago
                                            FROM ventas v
                                            JOIN clientes c ON v.cliente_id = c.id
                                            WHERE v.fecha = ?
                                            AND v.estado != 'cancelado'
                                            AND v.tipo_pago != 'pendiente de seleccion'
                                            ORDER BY c.nombre ASC;
                                        `, [fecha]);

        // Si no hay resultados, retornar un mensaje de error
        if (!result || !result.rows || result.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay ventas registradas para esa fecha' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 202
            });
        }
        
        // Retornar los clientes en formato JSON
        return new Response(JSON.stringify(result.rows), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching products:', error);
        return new Response('Error fetching products', { status: 500 });
    }
}

export async function POST({ request }) {
    
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }
    
    try {
        const body = await request.json();
        const {fecha, tipoPago, clienteId, totalDeVenta } = body;

        if (!fecha || !clienteId || !tipoPago || !totalDeVenta) {
            return new Response('Faltan datos válidos del producto', { status: 400 });
        }

        if (totalDeVenta <= 0) {
            return new Response('El total de la venta debe ser mayor a cero', { status: 400 });
        }

        const cliente = await db.execute(
            'SELECT id FROM clientes WHERE id = ? AND estatus = "activo"',
            [clienteId]
        );

        if (!cliente.rows?.length) {
            return new Response(JSON.stringify({ error: 'Cliente no encontrado o inactivo' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        let estado;

        if (tipoPago === 'credito') {
            estado = 'pendiente';
        } else if (tipoPago === 'contado') {
            estado = 'completado';
        } else {
            return new Response(JSON.stringify({ error: 'Tipo de pago inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const ventaIdSafe = await withTransaction(db, async (tx) => {
            const result = await tx.execute(
                'INSERT INTO ventas (fecha, cliente_id, total, estado, tipo_pago) VALUES (?, ?, ?, ?, ?)',
                [fecha, clienteId, totalDeVenta, estado, tipoPago]
            );

            const ventaId = normalizarId(result.lastInsertRowid);

            if (tipoPago === 'credito') {
                await tx.execute(
                    'INSERT INTO creditos (id_venta, saldo_pendiente) VALUES (?, ?)',
                    [ventaId, totalDeVenta]
                );
            }

            return ventaId;
        });

        return new Response(JSON.stringify({ message: 'Venta registrada exitosamente', ventaId: ventaIdSafe }), { status: 201, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error inserting product:', error);
        return new Response('Error inserting product', { status: 500 });
    }
}