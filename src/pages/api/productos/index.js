import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { ACCIONES, registrarBitacora, registrarBitacoraEnTx } from '@/utils/bitacora.js';
import { withTransaction, executeInTx } from '@/utils/dbTransaction.js';

const LIMITE_BUSQUEDA = 50;
const LIMITE_LISTA = 80;
const LIMITE_MAXIMO = 500;

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

        const limit = Math.min(
            parseInt(url.searchParams.get('limit')) || (search ? LIMITE_BUSQUEDA : LIMITE_LISTA),
            LIMITE_MAXIMO
        );
        const offset = (page - 1) * limit;
        const columnasLista = 'id, codigo, nombre, descripcion, stock, costo, venta, unidad_medida';

        const query = search ? {
                                    sql: `
                                        SELECT ${columnasLista} FROM productos 
                                        WHERE (nombre LIKE ? OR codigo LIKE ?)
                                        AND estatus = 'activo' 
                                        ORDER BY nombre ASC
                                        LIMIT ? OFFSET ?
                                    `,
                                    args: [`%${search}%`, `%${search}%`, limit, offset],
                                }
                            : {
                                    sql: `
                                        SELECT ${columnasLista} FROM productos 
                                        WHERE estatus = 'activo'
                                        ORDER BY nombre ASC
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
        const { codigo, nombre, descripcion = '', stock, costo, venta, unidad_medida = 'UNIDAD', seriales } = body;

        // Validaciones y normalización
        const stockStr = String(stock ?? '').trim().replace(',', '.');
        const costoStr = String(costo ?? '').trim().replace(',', '.');
        const ventaStr = String(venta ?? '').trim().replace(',', '.');

        const esDecimalPositivo = /^\d+(\.\d+)?$/;

        const stockFinal = parseFloat(stockStr);
        const costoFinal = parseFloat(costoStr);
        const ventaFinal = parseFloat(ventaStr);

        const stockValido = esDecimalPositivo.test(stockStr) && Number.isFinite(stockFinal) && stockFinal >= 0;
        const costoValido = esDecimalPositivo.test(costoStr) && Number.isFinite(costoFinal) && costoFinal >= 0;
        const ventaValida = esDecimalPositivo.test(ventaStr) && Number.isFinite(ventaFinal) && ventaFinal >= 0;

        if (!codigo || !nombre || !stockValido || !costoValido || !ventaValida) {
            return new Response('Faltan datos válidos del producto', { status: 400 });
        }

        // Validacion para que no se ingrese otro codigo igual
        const existe = await db.execute('SELECT 1 FROM productos WHERE codigo = ?', [codigo]);

        if (existe.rows.length > 0) {
            return new Response('Ya existe un producto con ese código', { status: 409 });
        }

        // Si mandan seriales, validar
        if (Array.isArray(seriales) && seriales.length > 0) {
            if (seriales.length !== stockFinal) {
                return new Response('La cantidad de seriales no coincide con el stock.', { status: 400 });
            }
            const vacios = seriales.some(s => !s || s.trim() === '');
            if (vacios) {
                return new Response('Hay seriales vacíos.', { status: 400 });
            }
        }

        await withTransaction(db, async (tx) => {
            // Insertar el nuevo producto en la base de datos
            const result = await executeInTx(tx, 'INSERT INTO productos (codigo, nombre, descripcion, stock, costo, venta, unidad_medida) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',[codigo, nombre, descripcion, stockFinal, costoFinal, ventaFinal, unidad_medida]);

            const productoId = result.rows[0].id;

            if (Array.isArray(seriales) && seriales.length > 0) {
                for (const serial of seriales) {
                    await executeInTx(tx, `INSERT INTO seriales (serial, producto_id, estado) VALUES (?, ?, 'disponible')`, [serial, productoId]);
                }
            }

            if (stockFinal > 0) {
                const fechaHoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Caracas' });
                const horaHoy = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Caracas' });

                await executeInTx(tx, 
                    `INSERT INTO movimientos_inventario (producto_id, codigo_producto, nombre_producto, tipo, cantidad, stock_antes, stock_despues, motivo, usuario_id, usuario_nombre, fecha, hora) 
                     VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        productoId, codigo, nombre, stockFinal, 0, stockFinal, 
                        'Ajuste inicial de inventario (Creación)', usuario.id, usuario.nombre, fechaHoy, horaHoy
                    ]
                );
            }

            await registrarBitacoraEnTx(tx, {
                usuario,
                accion: ACCIONES.PRODUCTO_NUEVO,
                entidad: 'productos',
                entidadId: productoId,
                detalle: `${codigo} — ${nombre} · stock ${stockFinal} · venta ${ventaFinal}`,
            });
        });

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

        if (!id) {
            return new Response(JSON.stringify({ error: 'Falta el ID del producto' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const productoActivo = await db.execute(
            "SELECT id FROM productos WHERE id = ? AND estatus = 'activo'",
            [id]
        );

        if (!productoActivo.rows?.length) {
            return new Response(JSON.stringify({ error: 'Producto no encontrado o ya inactivo' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const ventasPendientes = await db.execute(
            `SELECT COUNT(*) AS total
             FROM detalle_venta dv
             JOIN ventas v ON dv.id_venta = v.id
             WHERE dv.producto_id = ?
             AND v.estado = 'pendiente'`,
            [id]
        );

        if (Number(ventasPendientes.rows[0]?.total ?? 0) > 0) {
            return new Response(JSON.stringify({
                error: 'No se puede inactivar el producto porque está en ventas a crédito pendientes'
            }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        const result = await db.execute('UPDATE productos SET estatus = "inactivo" WHERE id = ?', [id]);

        if ((result.rowsAffected ?? result.affectedRows ?? 0) === 0) {
            return new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        await registrarBitacora(db, {
            usuario,
            accion: ACCIONES.PRODUCTO_ELIMINAR,
            entidad: 'productos',
            entidadId: id,
            detalle: `Producto #${id} inactivado`,
        });

        return new Response(JSON.stringify({ message: 'Producto inactivado exitosamente' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

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
        const { id, codigo, nombre, descripcion = '', stock, costo, venta, unidad_medida, seriales } = body;

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

        // Si mandan seriales, validar
        if (Array.isArray(seriales)) {
            if (seriales.length !== stockFinal) {
                return new Response('La cantidad de seriales no coincide con el stock.', { status: 400 });
            }
            const vacios = seriales.some(s => !s || s.trim() === '');
            if (vacios) {
                return new Response('Hay seriales vacíos.', { status: 400 });
            }
        }

        let updated = false;

        await withTransaction(db, async (tx) => {
            // Actualizar el producto en la base de datos
            const result = await executeInTx(tx, 'UPDATE productos SET codigo = ?, nombre = ?, descripcion = ?, stock = ?, costo = ?, venta = ?, unidad_medida = ? WHERE id = ?', [codigo, nombre, descripcion, stockFinal, costoFinal, ventaFinal, unidad_medida, id]);

            if (result.affectedRows === 0) {
                throw new Error('Producto no encontrado');
            }
            
            updated = true;

            // Logica de seriales
            if (Array.isArray(seriales)) {
                // Obtener seriales disponibles actuales
                const actualesRes = await executeInTx(tx, 'SELECT serial FROM seriales WHERE producto_id = ? AND estado = "disponible"', [id]);
                const actuales = actualesRes.rows.map(r => r.serial);
                
                const agregados = seriales.filter(s => !actuales.includes(s));
                const eliminados = actuales.filter(s => !seriales.includes(s));
                
                for (const serial of eliminados) {
                    await executeInTx(tx, 'DELETE FROM seriales WHERE serial = ? AND producto_id = ? AND estado = "disponible"', [serial, id]);
                }
                
                for (const serial of agregados) {
                    const existeRes = await executeInTx(tx, 'SELECT id, producto_id, estado FROM seriales WHERE serial = ?', [serial]);
                    if (existeRes.rows && existeRes.rows.length > 0) {
                        const row = existeRes.rows[0];
                        if (row.producto_id !== id && row.estado === 'disponible') {
                            throw Object.assign(new Error(`El serial ${serial} ya está registrado y activo en otro producto`), { status: 409 });
                        }
                        await executeInTx(tx, 'UPDATE seriales SET estado = "disponible", producto_id = ?, id_venta = NULL WHERE id = ?', [id, row.id]);
                    } else {
                        await executeInTx(tx, 'INSERT INTO seriales (serial, producto_id, estado) VALUES (?, ?, "disponible")', [serial, id]);
                    }
                }
            }

            await registrarBitacoraEnTx(tx, {
                usuario,
                accion: ACCIONES.PRODUCTO_EDITAR,
                entidad: 'productos',
                entidadId: id,
                detalle: `${codigo} — ${nombre} · stock ${stockFinal} · costo ${costoFinal} · venta ${ventaFinal}`,
            });
        });

        if (!updated) {
             return new Response('Producto no encontrado', { status: 404 });
        }

        return new Response(JSON.stringify({ message: "Producto actualizado exitosamente" }), { status: 200 });

    } catch (error) {
        console.error('Error updating producto:', error);
        return new Response('Error updating producto', { status: 500 });
    }
}