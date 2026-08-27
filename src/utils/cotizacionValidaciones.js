export { parsearItemVenta as parsearItemCotizacion, normalizarId } from '@/utils/ventaValidaciones';
export { executeInTx } from '@/utils/dbTransaction';

import { executeInTx } from '@/utils/dbTransaction';
import { validarCliente } from '@/utils/clienteValidaciones.js';

export async function verificarProductoExiste(tx, productoId) {
    const result = await executeInTx(
        tx,
        'SELECT id, codigo, estatus, nombre FROM productos WHERE id = ?',
        [productoId]
    );

    if (!result.rows?.length) {
        return { ok: false, error: 'Producto no encontrado' };
    }

    const producto = result.rows[0];

    if (producto.estatus !== 'activo') {
        return { ok: false, error: `Producto ${producto.codigo} no está activo` };
    }

    return { ok: true, producto };
}

export async function insertarDetalleCotizacion(tx, cotizacionId, item) {
    await executeInTx(
        tx,
        `INSERT INTO detalle_cotizacion
            (id_cotizacion, producto_id, codigo_producto, nombre_producto, precio_unitario, cantidad)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [cotizacionId, item.productoId, item.codigo, item.nombre, item.precio, item.cantidad]
    );
}

export function validarDatosClienteCotizacion({
    clienteNombre,
    clienteCedulaRif,
    clienteTelefono,
    clienteDireccion,
}) {
    const validado = validarCliente({
        nombre: clienteNombre,
        cedula: clienteCedulaRif,
        telefono: clienteTelefono,
        direccion: clienteDireccion,
    });

    if (!validado.ok) {
        return validado;
    }

    return {
        ok: true,
        cliente: {
            nombre: validado.cliente.nombre,
            cedulaRif: validado.cliente.cedula,
            telefono: validado.cliente.telefono,
            direccion: validado.cliente.direccion,
        },
    };
}

export function calcularTotalCotizacion(items) {
    return items.reduce(
        (suma, item) => suma + parseFloat(item.precio) * parseFloat(item.cantidad),
        0
    );
}
