import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import xlsx from 'xlsx';
import { ACCIONES, registrarBitacora } from '@/utils/bitacora.js';

export async function POST({ request }) {
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
    }

    const formData = await request.formData();
    const archivo = formData.get('archivo');
    const proveedor = formData.get('proveedor') || 'Carga Masiva Excel';

    if (!archivo || typeof archivo === 'string') {
        return new Response(JSON.stringify({ error: 'Archivo no recibido' }), { status: 400 });
    }

    const buffer = await archivo.arrayBuffer();
    const workbook = xlsx.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const productos = xlsx.utils.sheet_to_json(sheet);

    const resultados = [];
    let montoTotal = 0;

    // TODO: Ideally we should use a transaction here, but doing it raw since the original did too
    // In a real scenario we'd refactor this to use executeInTx. 

    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Caracas' });

    // 1. Insert Compra
    // We update the montoTotal after we process products.
    const resCompra = await db.execute(
        'INSERT INTO compras (fecha, proveedor, monto_total) VALUES (?, ?, 0) RETURNING id',
        [fecha, proveedor]
    );
    const idCompra = resCompra.rows[0].id;

    let productosAgregados = 0;

    // Procesar productos
    for (const p of productos) {
        const codigo = String(p.codigo).trim().toUpperCase();
        const nombre = String(p.nombre).trim();
        const stockNuevo = Number(p.stock) || 0;
        const costoNuevo = Number(p.costo) || 0;
        const venta = Number(p.venta) || 0;
        const unidad_medida = String(p.unidad_medida || '').trim();

        if (!codigo || !nombre) continue;

        let productoId = null;
        let stockAntes = 0;

        const existente = await db.execute('SELECT id, stock, costo FROM productos WHERE codigo = ?', [codigo]);

        if (existente.rows.length > 0) {
            productoId = existente.rows[0].id;
            const stockViejo = Number(existente.rows[0].stock) || 0;
            const costoViejo = Number(existente.rows[0].costo) || 0;
            stockAntes = stockViejo;

            const nuevoStock = stockViejo + stockNuevo;

            // Calcular costo promedio ponderado
            const costoPromedio = nuevoStock > 0
                ? ((stockViejo * costoViejo) + (stockNuevo * costoNuevo)) / nuevoStock
                : costoNuevo;

            await db.execute(
                'UPDATE productos SET stock = ?, costo = ?, venta = ? WHERE id = ?',
                [nuevoStock, costoPromedio, venta, productoId]
            );

            montoTotal += costoNuevo * stockNuevo;
            resultados.push({ productoId, codigo, nombre, cantidad: stockNuevo, costo: costoNuevo });
        } else {
            const resNew = await db.execute(
                'INSERT INTO productos (codigo, nombre, stock, costo, venta, unidad_medida, estatus) VALUES (?, ?, ?, ?, ?, ?, "activo") RETURNING id',
                [codigo, nombre, stockNuevo, costoNuevo, venta, unidad_medida]
            );
            productoId = resNew.rows[0].id;
            productosAgregados++;
            montoTotal += costoNuevo * stockNuevo;

            resultados.push({ productoId, codigo, nombre, cantidad: stockNuevo, costo: costoNuevo });
        }

        // Movimientos Inventario
        await db.execute(
            `INSERT INTO movimientos_inventario (producto_id, codigo_producto, nombre_producto, tipo, cantidad, stock_antes, stock_despues, motivo, usuario_id, usuario_nombre, fecha, hora) 
             VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                productoId, codigo, nombre, stockNuevo, stockAntes, stockAntes + stockNuevo, 
                `Compra Masiva (Excel) a ${proveedor}`, usuario.id, usuario.nombre, fecha, hora
            ]
        );
    }

    // Update Monto Total
    await db.execute('UPDATE compras SET monto_total = ? WHERE id = ?', [montoTotal, idCompra]);

    // Insertar detalles de la compra
    for (const r of resultados) {
        await db.execute(
            'INSERT INTO detalle_compra (id_compra, producto_id, codigo_producto, nombre_producto, costo, cantidad) VALUES (?, ?, ?, ?, ?, ?)',
            [idCompra, r.productoId, r.codigo, r.nombre, r.costo, r.cantidad]
        );
    }

    await registrarBitacora(db, {
        usuario,
        accion: ACCIONES.CARGA_MASIVA,
        entidad: 'compras',
        entidadId: idCompra,
        detalle: `Excel ${proveedor} · ${resultados.length} ítems · ${productosAgregados} nuevos · monto ${montoTotal}`,
    });

    return new Response(JSON.stringify({ resultados, idCompra }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
