import { db } from '../db';
import { verificarToken } from '@/utils/auth';

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

        let estado;

        if (tipoPago === 'credito') {
            estado = 'pendiente';
        }
        if (tipoPago === 'contado') {
            estado = 'completado';
        }

        // Insertar el nuevo cliente en la base de datos
        const result = await db.execute(`INSERT INTO ventas (fecha, cliente_id, total, estado, tipo_pago) VALUES (?, ?, ?, ?, ?)`,
        [fecha, clienteId, totalDeVenta, estado, tipoPago]
        );

        // Obtener el ID generado
        const ventaId = result.lastInsertRowid;
        const ventaIdSafe = typeof ventaId === 'bigint' ? ventaId.toString() : ventaId;

        // Agregar la venta a creditos si el tipo de pago es credito
        if (tipoPago === 'credito'){
            await db.execute(`INSERT INTO creditos (id_venta, saldo_pendiente) VALUES (?, ?)`,[ventaIdSafe, totalDeVenta]);
        }

        return new Response(JSON.stringify({ message: "Venta registrada exitosamente", ventaId: ventaIdSafe }),
        { status: 201 });

    } catch (error) {
        console.error('Error inserting product:', error);
        return new Response('Error inserting product', { status: 500 });
    }
}