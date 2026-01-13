import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {

        const url = new URL(request.url);
        const ventaId = parseInt(url.searchParams.get('ventaId'));

        const productosSeleccionados = await db.execute('SELECT * FROM detalle_venta WHERE id_venta = ?', [ventaId]);

        // Si no hay clientes, retornar un mensaje de error
        if (!productosSeleccionados || !productosSeleccionados.rows || productosSeleccionados.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay productos registrados para esa venta' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 204
            });
        }
        
        // Retornar los clientes en formato JSON
        return new Response(JSON.stringify(productosSeleccionados.rows), {
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
        const { ventaId, idProducto, codigo, nombre, precio, cantidad } = body;

        // Validaciones
        const esDecimalPositivo = /^\d+(\.\d+)?$/;

        const cantidadValida = esDecimalPositivo.test(cantidad) && parseFloat(cantidad) > 0;
        const precioUnitarioValido = esDecimalPositivo.test(precio) && parseFloat(precio) >= 0;
        

        if (!ventaId || !idProducto || !codigo || !nombre || !precioUnitarioValido || !cantidadValida) {
            return new Response('Faltan datos válidos del producto', { status: 400 });
        }

        // Parseo
        const cantidadFinal = parseFloat(cantidad).toFixed(2);
        const precioUnitarioFinal = parseFloat(precio).toFixed(2);

        const result = await db.execute(`INSERT INTO detalle_venta (id_venta, producto_id, codigo_producto, nombre_producto, precio_unitario, cantidad) VALUES (?, ?, ?, ?, ?, ?)`,
        [ventaId, idProducto, codigo, nombre, precioUnitarioFinal, cantidadFinal]
        );

        // Descontar del stock
        await db.execute(`UPDATE productos SET stock = (stock - ?) WHERE codigo = ?`,
        [cantidadFinal, codigo]
        );

        return new Response(JSON.stringify({ message: "Producto registrada exitosamente en la venta" }),
        { status: 201 });

    } catch (error) {
        console.error('Error inserting product:', error);
        return new Response('Error inserting product', { status: 500 });
    }
}

