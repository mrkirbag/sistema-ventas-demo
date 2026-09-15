import { executeInTx } from './dbTransaction.js';
import { fechaHoraVenezuela } from './helpers/formateoFecha.js';

export const ACCIONES = {
    VENTA: 'venta',
    CREDITO: 'credito',
    ABONO: 'abono',
    ANULAR_VENTA: 'anular_venta',
    DEVOLUCION: 'devolucion',
    TASA: 'tasa',
    PRODUCTO_NUEVO: 'producto_nuevo',
    PRODUCTO_EDITAR: 'producto_editar',
    PRODUCTO_ELIMINAR: 'producto_eliminar',
    STOCK_ENTRADA: 'stock_entrada',
    STOCK_SALIDA: 'stock_salida',
    CARGA_MASIVA: 'carga_masiva',
    COTIZACION: 'cotizacion',
    CLIENTE_NUEVO: 'cliente_nuevo',
    CLIENTE_EDITAR: 'cliente_editar',
    CLIENTE_ELIMINAR: 'cliente_eliminar',
    CLIENTE_REACTIVAR: 'cliente_reactivar',
    USUARIO_NUEVO: 'usuario_nuevo',
    USUARIO_ELIMINAR: 'usuario_eliminar',
    LOGIN: 'login',
    LOGOUT: 'logout',
};

export const ETIQUETAS_ACCION = {
    venta: 'Venta de contado',
    credito: 'Venta a crédito',
    abono: 'Abono a crédito',
    anular_venta: 'Anulación de venta',
    devolucion: 'Devolución',
    tasa: 'Cambio de tasa',
    producto_nuevo: 'Producto nuevo',
    producto_editar: 'Edición de producto',
    producto_eliminar: 'Producto inactivado',
    stock_entrada: 'Entrada de stock',
    stock_salida: 'Salida de stock',
    carga_masiva: 'Carga masiva',
    cotizacion: 'Cotización',
    cliente_nuevo: 'Cliente nuevo',
    cliente_editar: 'Edición de cliente',
    cliente_eliminar: 'Cliente inactivado',
    cliente_reactivar: 'Cliente reactivado',
    usuario_nuevo: 'Usuario nuevo',
    usuario_eliminar: 'Usuario eliminado',
    login: 'Inicio de sesión',
    logout: 'Cierre de sesión',
};

const SQL_CREAR = `
    CREATE TABLE IF NOT EXISTS bitacora (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha           TEXT    NOT NULL,
        hora            TEXT    NOT NULL,
        usuario_id      INTEGER,
        usuario_nombre  TEXT    NOT NULL,
        accion          TEXT    NOT NULL,
        entidad         TEXT,
        entidad_id      INTEGER,
        detalle         TEXT    NOT NULL DEFAULT '',
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
`;

const SQL_INSERT = `
    INSERT INTO bitacora
        (fecha, hora, usuario_id, usuario_nombre, accion, entidad, entidad_id, detalle)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

function armarArgs({ usuario, accion, entidad = null, entidadId = null, detalle = '' }) {
    const { fecha, hora } = fechaHoraVenezuela();
    const texto = typeof detalle === 'string' ? detalle : JSON.stringify(detalle);

    let entidadIdSanitizado = null;
    if (entidadId !== null && entidadId !== undefined) {
        if (typeof entidadId === 'number') {
            entidadIdSanitizado = Number.isFinite(entidadId) ? String(entidadId) : null;
        } else {
            entidadIdSanitizado = String(entidadId).trim() || null;
        }
    }

    let usuarioIdSanitizado = null;
    if (usuario?.id !== null && usuario?.id !== undefined) {
        if (typeof usuario.id === 'number') {
            usuarioIdSanitizado = Number.isFinite(usuario.id) ? String(usuario.id) : null;
        } else {
            usuarioIdSanitizado = String(usuario.id).trim() || null;
        }
    }

    return [
        fecha,
        hora,
        usuarioIdSanitizado,
        usuario?.nombre || usuario?.usuario || 'Sistema',
        accion,
        entidad,
        entidadIdSanitizado,
        texto,
    ];
}

export async function registrarBitacora(db, opts) {
    await db.execute(SQL_CREAR);
    await db.execute({ sql: SQL_INSERT, args: armarArgs(opts) });
}

export async function registrarBitacoraEnTx(tx, opts) {
    await executeInTx(tx, SQL_CREAR, []);
    await executeInTx(tx, SQL_INSERT, armarArgs(opts));
}
