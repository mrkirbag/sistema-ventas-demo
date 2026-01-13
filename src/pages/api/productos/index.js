import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    // Verificar autenticación
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    } 

    try {

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const search = url.searchParams.get('search') || '';

        const limit = 100000;
        const offset = (page - 1) * limit;

        const query = search ? {
                                    sql: `
                                        SELECT * FROM productos 
                                        WHERE (nombre LIKE ? OR codigo LIKE ?)
                                        AND estatus = 'activo' 
                                        ORDER BY LOWER(REPLACE(nombre, ' ', '')) ASC
                                        LIMIT ? OFFSET ?
                                    `,
                                    args: [`%${search}%`, `%${search}%`, limit, offset],
                                }
                            : {
                                    sql: `
                                        SELECT * FROM productos 
                                        WHERE estatus = 'activo'
                                        ORDER BY LOWER(REPLACE(nombre, ' ', '')) ASC
                                        LIMIT ? OFFSET ?
                                    `,
                                    args: [limit, offset],
                                };


        const result = await db.execute(query);

        // Si no hay clientes, retornar un mensaje de error
        if (!result || !result.rows || result.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay productos registrados' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
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

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response('No autorizado', { status: 403 });
    }

    try {

        const body = await request.json();
        const { codigo, nombre, stock, costo, venta, unidad_medida } = body;

        // Validaciones
        const esDecimalPositivo = /^\d+(\.\d+)?$/;

        const stockValido = esDecimalPositivo.test(stock) && parseFloat(stock) >= 0;
        const costoValido = esDecimalPositivo.test(costo) && parseFloat(costo) >= 0;
        const ventaValida = esDecimalPositivo.test(venta) && parseFloat(venta) >= 0;

        if (!codigo || !nombre || !stockValido || !costoValido || !ventaValida) {
            return new Response('Faltan datos válidos del producto', { status: 400 });
        }

        // Validacion para que no se ingrese otro codigo igual
        const existe = await db.execute('SELECT 1 FROM productos WHERE codigo = ?', [codigo]);

        if (existe.rows.length > 0) {
            return new Response('Ya existe un producto con ese código', { status: 409 });
        }

        // Parseo
        const stockFinal = parseFloat(stock);
        const costoFinal = parseFloat(costo);
        const ventaFinal = parseFloat(venta);

        // Insertar el nuevo cliente en la base de datos
        const result = await db.execute('INSERT INTO productos (codigo, nombre, stock, costo, venta, unidad_medida) VALUES (?, ?, ?, ?, ?, ?)',[codigo, nombre, stockFinal, costoFinal, ventaFinal, unidad_medida]);

        return new Response(JSON.stringify({ message: "Producto agregado exitosamente" }), { status: 201 });

    } catch (error) {
        console.error('Error inserting product:', error);
        return new Response('Error inserting product', { status: 500 });
    }
}

export async function DELETE({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response('No autorizado', { status: 403 });
    }

    try {
        const body = await request.json();
        const { id } = body;

        // Validar que se haya proporcionado un ID
        if (!id) {
            return new Response('Falta el ID del producto', { status: 400 });
        }

        // Eliminar el cliente de la base de datos
        const result = await db.execute('UPDATE productos SET estatus = "inactivo" WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return new Response('Producto no encontrado', { status: 404 });
        }

        return new Response(JSON.stringify({ message: "Producto eliminado exitosamente" }), { status: 200 });

    } catch (error) {
        console.error('Error deleting product:', error);
        return new Response('Error deleting product', { status: 500 });
    }
}

export async function PUT({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response('No autorizado', { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, codigo, nombre, stock, costo, venta, unidad_medida } = body;

        // Validaciones
        const esDecimalPositivo = /^\d+(\.\d+)?$/;

        const stockValido = esDecimalPositivo.test(stock) && parseFloat(stock) >= 0;
        const costoValido = esDecimalPositivo.test(costo) && parseFloat(costo) >= 0;
        const ventaValida = esDecimalPositivo.test(venta) && parseFloat(venta) >= 0;
        const unidadMedidaValida = typeof unidad_medida === 'string' && unidad_medida.trim() !== '';

        if (!codigo || !nombre || !stockValido || !costoValido || !ventaValida || !unidadMedidaValida){
            return new Response('Faltan datos válidos del producto', { status: 400 });
        }

        // Validacion para que no se ingrese otro codigo igual
        const existe = await db.execute('SELECT 1 FROM productos WHERE codigo = ? AND id != ?', [codigo, id]);

        if (existe.rows.length > 0) {
            return new Response('Ya existe un producto con ese código', { status: 409 });
        }

        // Parseo
        const stockFinal = parseFloat(stock);
        const costoFinal = parseFloat(costo);
        const ventaFinal = parseFloat(venta);

        // Actualizar el cliente en la base de datos
        const result = await db.execute('UPDATE productos SET codigo = ?, nombre = ?, stock = ?, costo = ?, venta = ?, unidad_medida = ? WHERE id = ?', [codigo, nombre, stockFinal, costoFinal, ventaFinal, unidad_medida, id]);

        // Validar si no se encuentra
        if (result.affectedRows === 0) {
            return new Response('Producto no encontrado', { status: 404 });
        }

        return new Response(JSON.stringify({ message: "Producto actualizado exitosamente" }), { status: 200 });

    } catch (error) {
        console.error('Error updating producto:', error);
        return new Response('Error updating producto', { status: 500 });
    }
}