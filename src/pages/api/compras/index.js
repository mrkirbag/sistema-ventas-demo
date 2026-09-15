import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { withTransaction, executeInTx } from '@/utils/dbTransaction';
import { ACCIONES, registrarBitacoraEnTx } from '@/utils/bitacora';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function GET({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {
        const query = 'SELECT * FROM compras ORDER BY fecha DESC, id DESC';
        const compras = await db.execute(query);

        if (!compras || !compras.rows || compras.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay compras registradas' }), {
                status: 202,
                headers: jsonHeaders
            });
        }
        
        return new Response(JSON.stringify(compras.rows), { headers: jsonHeaders });
    } catch (error) {
        console.error('Error fetching compras:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: jsonHeaders });
    }
}

export async function POST({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403, headers: jsonHeaders });
    }

    try {
        const userCheck = await db.execute('SELECT id FROM usuarios WHERE id = ?', [usuario.id]);
        if (userCheck.rows.length === 0) {
            return new Response(JSON.stringify({ error: 'Usuario inválido o sesión expirada' }), { status: 401, headers: jsonHeaders });
        }

        const body = await request.json();
        const { fecha, proveedor, monto_total, productos } = body;

        if (!fecha || !proveedor || typeof monto_total !== 'number') {
            return new Response(JSON.stringify({ error: 'Datos incompletos de la cabecera' }), { status: 400, headers: jsonHeaders });
        }

        if (!Array.isArray(productos) || productos.length === 0) {
            return new Response(JSON.stringify({ error: 'Debe agregar al menos un producto' }), { status: 400, headers: jsonHeaders });
        }

        let sumaSubtotales = 0;
        for (const p of productos) {
            sumaSubtotales += (p.costo * p.cantidad);
            if (p.seriales && Array.isArray(p.seriales) && p.seriales.length > 0) {
                if (p.seriales.length !== p.cantidad) {
                    return new Response(JSON.stringify({ error: `La cantidad de seriales del producto ${p.codigo} no coincide con la cantidad ingresada.` }), { status: 400, headers: jsonHeaders });
                }
            }
        }

        // Validate that the total amount exactly matches the sum of subtotals
        if (Math.abs(sumaSubtotales - monto_total) > 0.01) {
            return new Response(JSON.stringify({ error: 'El monto total de la factura no coincide con la suma de los productos' }), { status: 400, headers: jsonHeaders });
        }

        await withTransaction(db, async (tx) => {
            // 1. Insert Compra
            const resCompra = await executeInTx(tx, 
                `INSERT INTO compras (fecha, proveedor, monto_total) VALUES (?, ?, ?) RETURNING id`,
                [fecha, proveedor, monto_total]
            );
            const idCompra = resCompra.rows[0].id;

            // 2. Process Products
            const horaHora = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Caracas' });
            
            for (const p of productos) {
                let productoId = p.id;
                let stockAntes = 0;

                if (!productoId) {
                    // Check if it exists by codigo just in case
                    const resExist = await executeInTx(tx, `SELECT id, stock FROM productos WHERE codigo = ?`, [p.codigo]);
                    if (resExist.rows.length > 0) {
                        productoId = resExist.rows[0].id;
                        stockAntes = Number(resExist.rows[0].stock);
                        
                        // Update stock and cost
                        await executeInTx(tx, 
                            `UPDATE productos SET stock = stock + ?, costo = ? WHERE id = ?`,
                            [p.cantidad, p.costo, productoId]
                        );
                    } else {
                        // Create new product
                        const resNewProd = await executeInTx(tx, 
                            `INSERT INTO productos (codigo, nombre, costo, venta, stock, unidad_medida) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
                            [p.codigo, p.nombre, p.costo, p.venta || 0, p.cantidad, p.unidad_medida || 'UNIDAD']
                        );
                        productoId = resNewProd.rows[0].id;
                    }
                } else {
                    // Product explicitly provided with ID
                    const resExist = await executeInTx(tx, `SELECT stock FROM productos WHERE id = ?`, [productoId]);
                    if (resExist.rows.length === 0) {
                        throw new Error(`Producto ID ${productoId} no existe`);
                    }
                    stockAntes = Number(resExist.rows[0].stock);

                    await executeInTx(tx, 
                        `UPDATE productos SET stock = stock + ?, costo = ? WHERE id = ?`,
                        [p.cantidad, p.costo, productoId]
                    );
                }

                // Insert into detalle_compra
                await executeInTx(tx, 
                    `INSERT INTO detalle_compra (id_compra, producto_id, codigo_producto, nombre_producto, costo, cantidad) VALUES (?, ?, ?, ?, ?, ?)`,
                    [idCompra, productoId, p.codigo, p.nombre, p.costo, p.cantidad]
                );

                // Insert into movimientos_inventario
                await executeInTx(tx, 
                    `INSERT INTO movimientos_inventario (producto_id, codigo_producto, nombre_producto, tipo, cantidad, stock_antes, stock_despues, motivo, usuario_id, usuario_nombre, fecha, hora) 
                     VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        productoId, p.codigo, p.nombre, p.cantidad, stockAntes, stockAntes + p.cantidad, 
                        `Compra a proveedor ${proveedor}`, usuario.id, usuario.nombre, fecha, horaHora
                    ]
                );

                // Process Serials
                if (p.seriales && Array.isArray(p.seriales)) {
                    for (const serial of p.seriales) {
                        await executeInTx(tx, 
                            `INSERT INTO seriales (producto_id, serial, estado, id_compra) VALUES (?, ?, 'disponible', ?)`,
                            [productoId, serial, idCompra]
                        );
                    }
                }
            }

            // Bitacora
            await registrarBitacoraEnTx(tx, {
                usuario,
                accion: 'REGISTRAR',
                entidad: 'compras',
                entidadId: idCompra,
                detalle: `Compra a ${proveedor} por ${monto_total}`
            });

        });

        return new Response(JSON.stringify({ message: 'Compra registrada exitosamente' }), { status: 201, headers: jsonHeaders });

    } catch (error) {
        console.error('Error al procesar compra:', error);
        
        // Return clear error if serial is duplicate
        if (error.message.includes('UNIQUE constraint failed: seriales.serial')) {
            return new Response(JSON.stringify({ error: 'Uno o más seriales ingresados ya existen en el sistema.' }), { status: 400, headers: jsonHeaders });
        }
        
        return new Response(JSON.stringify({ error: error.message || 'Error interno al registrar la compra' }), { status: 500, headers: jsonHeaders });
    }
}
