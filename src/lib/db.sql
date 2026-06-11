-- =============================================================================
-- SAVI Demo · Esquema de base de datos (Turso / libSQL / SQLite)
-- =============================================================================
-- Respaldo para recrear la estructura desde cero.
-- Ejecutar en la consola de Turso o con: turso db shell <nombre-db> < db.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Reinicio completo (opcional — descomentar solo si querés borrar todo)
-- -----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS abonos_credito;
-- DROP TABLE IF EXISTS detalle_carga_productos;
-- DROP TABLE IF EXISTS detalle_venta;
-- DROP TABLE IF EXISTS creditos;
-- DROP TABLE IF EXISTS ventas;
-- DROP TABLE IF EXISTS cargas_productos;
-- DROP TABLE IF EXISTS productos;
-- DROP TABLE IF EXISTS clientes;
-- DROP TABLE IF EXISTS usuarios;
-- DROP TABLE IF EXISTS tasa;

-- -----------------------------------------------------------------------------
-- usuarios
-- Roles usados en la app: 'admin' | 'empleado'
-- La contraseña se guarda hasheada con bcrypt (registro vía /api/usuarios/registrar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT    NOT NULL UNIQUE,
    clave   TEXT    NOT NULL,
    rol     TEXT    NOT NULL CHECK (rol IN ('admin', 'empleado')),
    nombre  TEXT    NOT NULL
);

-- -----------------------------------------------------------------------------
-- tasa
-- Tasa de cambio USD → COP. La app actualiza siempre el registro id = 1.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasa (
    id    INTEGER PRIMARY KEY,
    valor REAL    NOT NULL DEFAULT 0 CHECK (valor >= 0)
);

-- -----------------------------------------------------------------------------
-- clientes
-- Soft delete: estatus = 'inactivo' (no se borran físicamente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT    NOT NULL,
    telefono TEXT    NOT NULL,
    cedula   TEXT    NOT NULL UNIQUE,
    estatus  TEXT    NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'inactivo'))
);

-- -----------------------------------------------------------------------------
-- productos
-- Soft delete: estatus = 'inactivo'
-- codigo: identificador único del producto (se usa en ventas y cargas)
-- stock, costo, venta: valores decimales en USD
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo        TEXT    NOT NULL UNIQUE,
    nombre        TEXT    NOT NULL,
    stock         REAL    NOT NULL DEFAULT 0 CHECK (stock >= 0),
    costo         REAL    NOT NULL DEFAULT 0 CHECK (costo >= 0),
    venta         REAL    NOT NULL DEFAULT 0 CHECK (venta >= 0),
    unidad_medida TEXT    NOT NULL DEFAULT '',
    estatus       TEXT    NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'inactivo'))
);

-- -----------------------------------------------------------------------------
-- ventas
-- estado: 'pendiente' (crédito) | 'completado' | 'anulado' | 'cancelado' (legado)
-- tipo_pago: 'contado' | 'credito' | 'pendiente de seleccion' (legado)
-- fecha: formato ISO YYYY-MM-DD
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha      TEXT    NOT NULL,
    cliente_id INTEGER NOT NULL,
    total      REAL    NOT NULL CHECK (total >= 0),
    estado     TEXT    NOT NULL DEFAULT 'pendiente',
    tipo_pago  TEXT    NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- -----------------------------------------------------------------------------
-- detalle_venta
-- Copia código/nombre/precio al momento de la venta (histórico)
-- subtotal: columna calculada usada en reportes y vistas de detalle
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_venta (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venta         INTEGER NOT NULL,
    producto_id      INTEGER NOT NULL,
    codigo_producto  TEXT    NOT NULL,
    nombre_producto  TEXT    NOT NULL,
    precio_unitario  REAL    NOT NULL CHECK (precio_unitario >= 0),
    cantidad         REAL    NOT NULL CHECK (cantidad > 0),
    subtotal         REAL    GENERATED ALWAYS AS (precio_unitario * cantidad) STORED,
    FOREIGN KEY (id_venta)    REFERENCES ventas(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- -----------------------------------------------------------------------------
-- creditos
-- Una venta a crédito genera un registro aquí con saldo_pendiente = total inicial
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creditos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venta        INTEGER NOT NULL UNIQUE,
    saldo_pendiente REAL    NOT NULL DEFAULT 0 CHECK (saldo_pendiente >= 0),
    FOREIGN KEY (id_venta) REFERENCES ventas(id)
);

-- -----------------------------------------------------------------------------
-- abonos_credito
-- Pagos parciales o totales sobre un crédito
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abonos_credito (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    id_credito INTEGER NOT NULL,
    fecha      TEXT    NOT NULL,
    monto      REAL    NOT NULL CHECK (monto > 0),
    FOREIGN KEY (id_credito) REFERENCES creditos(id)
);

-- -----------------------------------------------------------------------------
-- cargas_productos
-- Registro de cargas masivas de inventario (importación Excel)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cargas_productos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha               TEXT    NOT NULL DEFAULT (date('now')),
    proveedor           TEXT    NOT NULL,
    monto_total         REAL    NOT NULL DEFAULT 0 CHECK (monto_total >= 0),
    productos_previos   INTEGER NOT NULL DEFAULT 0 CHECK (productos_previos >= 0),
    productos_agregados INTEGER NOT NULL DEFAULT 0 CHECK (productos_agregados >= 0)
);

-- -----------------------------------------------------------------------------
-- detalle_carga_productos
-- Líneas de detalle de cada carga masiva
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_carga_productos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    id_carga         INTEGER NOT NULL,
    codigo_producto  TEXT    NOT NULL,
    nombre_producto  TEXT    NOT NULL,
    costo            REAL    NOT NULL DEFAULT 0 CHECK (costo >= 0),
    unidades_nuevas  REAL    NOT NULL DEFAULT 0 CHECK (unidades_nuevas >= 0),
    FOREIGN KEY (id_carga) REFERENCES cargas_productos(id)
);

-- -----------------------------------------------------------------------------
-- Índices (consultas frecuentes del sistema)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clientes_estatus       ON clientes(estatus);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre        ON clientes(nombre);

CREATE INDEX IF NOT EXISTS idx_productos_estatus      ON productos(estatus);
CREATE INDEX IF NOT EXISTS idx_productos_codigo       ON productos(codigo);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha           ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente         ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado          ON ventas(estado);

CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta    ON detalle_venta(id_venta);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto ON detalle_venta(producto_id);

CREATE INDEX IF NOT EXISTS idx_creditos_venta         ON creditos(id_venta);
CREATE INDEX IF NOT EXISTS idx_abonos_credito         ON abonos_credito(id_credito);
CREATE INDEX IF NOT EXISTS idx_abonos_fecha           ON abonos_credito(fecha);

CREATE INDEX IF NOT EXISTS idx_detalle_carga          ON detalle_carga_productos(id_carga);

-- -----------------------------------------------------------------------------
-- Datos iniciales
-- Ejecutar después de crear las tablas: pnpm seed
-- (inserta el admin y la tasa; configurar variables SEED_* en .env)
-- -----------------------------------------------------------------------------
