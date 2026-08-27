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
-- DROP TABLE IF EXISTS pagos_venta;
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
-- Tasas del día respecto a 1 USD. La app actualiza siempre el registro id = 1.
-- valor: COP por 1 USD (también expuesto como `cop` en la API)
-- bs:    bolívares por 1 USD
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasa (
    id    INTEGER PRIMARY KEY,
    valor REAL    NOT NULL DEFAULT 0 CHECK (valor >= 0),
    bs    REAL    NOT NULL DEFAULT 0 CHECK (bs >= 0)
);

-- -----------------------------------------------------------------------------
-- clientes
-- nombre, telefono, cedula: texto. cedula almacena cédula o RIF.
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
-- stock, costo, venta: valores en la moneda base del comercio (empresa.json → monedaBase)
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
-- pagos_venta
-- Desglose de métodos de pago de cada venta de contado. Varios renglones por venta.
-- monto: cantidad recibida en esa moneda
-- monto_base: equivalente en la moneda base del comercio al momento de la venta
-- USD: efectivo, zelle, binance · COP: efectivo, bancolombia, nequi
-- BS: transferencia, pago_movil, punto_venta
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos_venta (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venta     INTEGER NOT NULL,
    moneda       TEXT    NOT NULL CHECK (moneda IN ('USD', 'COP', 'BS')),
    metodo       TEXT    NOT NULL,
    monto        REAL    NOT NULL CHECK (monto > 0),
    monto_base   REAL    NOT NULL CHECK (monto_base >= 0),
    moneda_base  TEXT    NOT NULL,
    tasa_cop     REAL    NOT NULL DEFAULT 0,
    tasa_bs      REAL    NOT NULL DEFAULT 0,
    FOREIGN KEY (id_venta) REFERENCES ventas(id)
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
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    id_credito     INTEGER NOT NULL,
    fecha          TEXT    NOT NULL,
    monto          REAL    NOT NULL CHECK (monto > 0),
    moneda         TEXT,
    metodo         TEXT,
    monto_recibido REAL,
    moneda_base    TEXT,
    tasa_cop       REAL    NOT NULL DEFAULT 0,
    tasa_bs        REAL    NOT NULL DEFAULT 0,
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
-- movimientos_inventario
-- Entradas y salidas manuales de stock (no incluye ventas).
-- fecha: YYYY-MM-DD · hora: HH:MM:SS (America/Caracas)
-- tipo: 'entrada' | 'salida'
-- Se copian código/nombre/usuario para conservar el histórico.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id     INTEGER NOT NULL,
    codigo_producto TEXT    NOT NULL,
    nombre_producto TEXT    NOT NULL,
    tipo            TEXT    NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    cantidad        REAL    NOT NULL CHECK (cantidad > 0),
    stock_antes     REAL    NOT NULL,
    stock_despues   REAL    NOT NULL CHECK (stock_despues >= 0),
    motivo          TEXT    NOT NULL,
    usuario_id      INTEGER NOT NULL,
    usuario_nombre  TEXT    NOT NULL,
    fecha           TEXT    NOT NULL,
    hora            TEXT    NOT NULL,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)
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

CREATE INDEX IF NOT EXISTS idx_pagos_venta_venta      ON pagos_venta(id_venta);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_metodo     ON pagos_venta(moneda, metodo);

CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta    ON detalle_venta(id_venta);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto ON detalle_venta(producto_id);

CREATE INDEX IF NOT EXISTS idx_creditos_venta         ON creditos(id_venta);
CREATE INDEX IF NOT EXISTS idx_abonos_credito         ON abonos_credito(id_credito);
CREATE INDEX IF NOT EXISTS idx_abonos_fecha           ON abonos_credito(fecha);

CREATE INDEX IF NOT EXISTS idx_detalle_carga          ON detalle_carga_productos(id_carga);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto   ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha      ON movimientos_inventario(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo       ON movimientos_inventario(tipo);

-- -----------------------------------------------------------------------------
-- cotizaciones
-- fecha: formato ISO YYYY-MM-DD
-- Datos del cliente almacenados en la cabecera (no FK a clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotizaciones (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha              TEXT    NOT NULL,
    cliente_nombre     TEXT    NOT NULL,
    cliente_cedula_rif TEXT    NOT NULL,
    cliente_telefono   TEXT    NOT NULL,
    cliente_direccion  TEXT    NOT NULL,
    total              REAL    NOT NULL CHECK (total >= 0)
);

-- -----------------------------------------------------------------------------
-- detalle_cotizacion
-- Copia código/nombre/precio al momento de la cotización (histórico)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_cotizacion (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cotizacion    INTEGER NOT NULL,
    producto_id      INTEGER NOT NULL,
    codigo_producto  TEXT    NOT NULL,
    nombre_producto  TEXT    NOT NULL,
    precio_unitario  REAL    NOT NULL CHECK (precio_unitario >= 0),
    cantidad         REAL    NOT NULL CHECK (cantidad > 0),
    subtotal         REAL    GENERATED ALWAYS AS (precio_unitario * cantidad) STORED,
    FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha              ON cotizaciones(fecha);
CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_cotizacion   ON detalle_cotizacion(id_cotizacion);
CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_producto     ON detalle_cotizacion(producto_id);

-- -----------------------------------------------------------------------------
-- bitacora
-- Registro de quién hizo ventas, abonos, anulaciones, créditos, tasas y productos.
-- fecha: YYYY-MM-DD · hora: HH:MM:SS (America/Caracas)
-- -----------------------------------------------------------------------------
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
);

CREATE INDEX IF NOT EXISTS idx_bitacora_fecha   ON bitacora(fecha);
CREATE INDEX IF NOT EXISTS idx_bitacora_accion  ON bitacora(accion);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario ON bitacora(usuario_id);

-- -----------------------------------------------------------------------------
-- Datos iniciales
-- Ejecutar después de crear las tablas: pnpm seed
-- (aplica el esquema si hace falta, inserta el admin, la tasa y el cliente de mostrador)
-- -----------------------------------------------------------------------------
