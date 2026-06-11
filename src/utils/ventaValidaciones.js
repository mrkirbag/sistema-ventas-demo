const esDecimalPositivo = /^\d+(\.\d+)?$/;

export function parsearItemVenta(item) {
    const { idProducto, id, codigo, nombre, precio, cantidad } = item;
    const productoId = idProducto ?? id;

    const cantidadStr = String(cantidad);
    const precioStr = String(precio);

    const cantidadValida = esDecimalPositivo.test(cantidadStr) && parseFloat(cantidadStr) > 0;
    const precioValido = esDecimalPositivo.test(precioStr) && parseFloat(precioStr) >= 0;

    if (!productoId || !codigo || !nombre || !cantidadValida || !precioValido) {
        return { ok: false, error: 'Faltan datos válidos del producto' };
    }

    return {
        ok: true,
        item: {
            productoId,
            codigo,
            nombre,
            precio: parseFloat(precioStr).toFixed(2),
            cantidad: parseFloat(cantidadStr).toFixed(2),
        },
    };
}

export async function verificarProductoDisponible(tx, codigo, cantidadRequerida) {
    const result = await tx.execute(
        'SELECT id, stock, estatus, nombre FROM productos WHERE codigo = ?',
        [codigo]
    );

    if (!result.rows?.length) {
        return { ok: false, error: `Producto ${codigo} no encontrado` };
    }

    const producto = result.rows[0];

    if (producto.estatus !== 'activo') {
        return { ok: false, error: `Producto ${codigo} no está activo` };
    }

    const stockDisponible = parseFloat(producto.stock);
    const cantidad = parseFloat(cantidadRequerida);

    if (stockDisponible < cantidad) {
        return {
            ok: false,
            error: `Stock insuficiente para ${codigo}. Disponible: ${stockDisponible}`,
        };
    }

    return { ok: true, producto };
}

export async function descontarStock(tx, codigo, cantidad) {
    const result = await tx.execute(
        `UPDATE productos SET stock = stock - ?
         WHERE codigo = ? AND estatus = 'activo' AND stock >= ?`,
        [cantidad, codigo, cantidad]
    );

    const afectadas = result.rowsAffected ?? result.affectedRows ?? 0;
    if (afectadas === 0) {
        throw new Error(`No se pudo descontar stock de ${codigo}`);
    }
}

export async function insertarDetalleVenta(tx, ventaId, item) {
    await tx.execute(
        `INSERT INTO detalle_venta
            (id_venta, producto_id, codigo_producto, nombre_producto, precio_unitario, cantidad)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [ventaId, item.productoId, item.codigo, item.nombre, item.precio, item.cantidad]
    );
}

export function normalizarId(id) {
    return typeof id === 'bigint' ? id.toString() : id;
}
