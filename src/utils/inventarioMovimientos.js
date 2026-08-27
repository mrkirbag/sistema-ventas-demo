import { withTransaction, executeInTx } from './dbTransaction.js';
import { fechaHoraVenezuela } from './helpers/formateoFecha.js';
import { ACCIONES, registrarBitacoraEnTx } from './bitacora.js';

const TIPOS = new Set(['entrada', 'salida']);
const MOTIVO_ENTRADA_DEFAULT = 'Reposición de inventario';

export function parsearCantidad(valor) {
    const normalizado = String(valor ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;

    const cantidad = parseFloat(normalizado);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return null;

    return cantidad;
}

export async function registrarMovimientoInventario(db, {
    productoId,
    tipo,
    cantidad,
    motivo,
    usuario,
}) {
    if (!TIPOS.has(tipo)) {
        const error = new Error('El tipo de movimiento no es válido');
        error.status = 400;
        throw error;
    }

    const cantidadNum = parsearCantidad(cantidad);
    if (cantidadNum === null) {
        const error = new Error('La cantidad debe ser un número positivo mayor a 0');
        error.status = 400;
        throw error;
    }

    const motivoFinal = String(motivo ?? '').trim()
        || (tipo === 'entrada' ? MOTIVO_ENTRADA_DEFAULT : '');

    if (!motivoFinal) {
        const error = new Error('El motivo es obligatorio para sacar stock');
        error.status = 400;
        throw error;
    }

    if (!usuario?.id) {
        const error = new Error('No autorizado');
        error.status = 401;
        throw error;
    }

    return withTransaction(db, async (tx) => {
        const producto = await executeInTx(
            tx,
            `SELECT id, codigo, nombre, stock, estatus
             FROM productos
             WHERE id = ?`,
            [productoId]
        );

        const fila = producto.rows?.[0];
        if (!fila) {
            const error = new Error('No hay producto con ese ID');
            error.status = 404;
            throw error;
        }

        if (fila.estatus !== 'activo') {
            const error = new Error('El producto está inactivo');
            error.status = 409;
            throw error;
        }

        const stockAntes = Number(fila.stock) || 0;
        const delta = tipo === 'salida' ? -cantidadNum : cantidadNum;
        const stockDespues = Math.round((stockAntes + delta) * 1000) / 1000;

        if (stockDespues < 0) {
            const error = new Error(`Stock insuficiente. Disponible: ${stockAntes}`);
            error.status = 409;
            throw error;
        }

        await executeInTx(
            tx,
            'UPDATE productos SET stock = ? WHERE id = ?',
            [stockDespues, productoId]
        );

        const { fecha, hora } = fechaHoraVenezuela();
        const usuarioNombre = usuario.nombre || usuario.usuario || 'Usuario';

        const insert = await executeInTx(
            tx,
            `INSERT INTO movimientos_inventario (
                producto_id, codigo_producto, nombre_producto, tipo, cantidad,
                stock_antes, stock_despues, motivo, usuario_id, usuario_nombre, fecha, hora
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fila.id,
                fila.codigo,
                fila.nombre,
                tipo,
                cantidadNum,
                stockAntes,
                stockDespues,
                motivoFinal,
                usuario.id,
                usuarioNombre,
                fecha,
                hora,
            ]
        );

        await registrarBitacoraEnTx(tx, {
            usuario,
            accion: tipo === 'salida' ? ACCIONES.STOCK_SALIDA : ACCIONES.STOCK_ENTRADA,
            entidad: 'productos',
            entidadId: Number(fila.id),
            detalle: `${fila.codigo} — ${fila.nombre} · ${tipo} ${cantidadNum} · stock ${stockAntes} → ${stockDespues} · ${motivoFinal}`,
        });

        return {
            movimientoId: Number(insert.lastInsertRowid ?? 0),
            stock: stockDespues,
            tipo,
            cantidad: cantidadNum,
        };
    });
}
