-- =============================================================================
-- SAVI Demo · Esquema de base de datos (Turso / libSQL / SQLite)
-- =============================================================================
-- Respaldo para recrear la estructura desde cero.
-- Ejecutar en la consola de Turso o con: turso db shell <nombre-db> < db.sql
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- -----------------------------------------------------------------------------
-- Reinicio completo (opcional — descomentar solo si querés borrar todo)
-- -----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS bitacora;
-- DROP TABLE IF EXISTS detalle_devolucion;
-- DROP TABLE IF EXISTS devoluciones;
-- DROP TABLE IF EXISTS detalle_cotizacion;
-- DROP TABLE IF EXISTS cotizaciones;
-- DROP TABLE IF EXISTS movimientos_inventario;
-- DROP TABLE IF EXISTS detalle_carga_productos;
-- DROP TABLE IF EXISTS cargas_productos;
-- DROP TABLE IF EXISTS seriales;
-- DROP TABLE IF EXISTS detalle_compra;
-- DROP TABLE IF EXISTS compras;
-- DROP TABLE IF EXISTS abonos_credito;
-- DROP TABLE IF EXISTS creditos;
-- DROP TABLE IF EXISTS detalle_venta;
-- DROP TABLE IF EXISTS pagos_venta;
-- DROP TABLE IF EXISTS ventas;
-- DROP TABLE IF EXISTS productos;
-- DROP TABLE IF EXISTS clientes;
-- DROP TABLE IF EXISTS usuarios;
-- DROP TABLE IF EXISTS tasa;

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    usuario TEXT    NOT NULL UNIQUE,
    clave   TEXT    NOT NULL,
    rol     TEXT    NOT NULL CHECK (rol IN ('admin', 'empleado')),
    nombre  TEXT    NOT NULL
);

-- -----------------------------------------------------------------------------
-- tasa
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasa (
    id    INTEGER PRIMARY KEY,
    valor REAL    NOT NULL DEFAULT 0 CHECK (valor >= 0),
    bs    REAL    NOT NULL DEFAULT 0 CHECK (bs >= 0)
);

-- -----------------------------------------------------------------------------
-- clientes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    nombre   TEXT    NOT NULL,
    telefono TEXT    NOT NULL,
    cedula   TEXT    NOT NULL UNIQUE,
    estatus  TEXT    NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'inactivo'))
);

-- -----------------------------------------------------------------------------
-- productos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    codigo        TEXT    NOT NULL UNIQUE,
    nombre        TEXT    NOT NULL,
    descripcion   TEXT    NOT NULL DEFAULT '',
    stock         REAL    NOT NULL DEFAULT 0 CHECK (stock >= 0),
    costo         REAL    NOT NULL DEFAULT 0 CHECK (costo >= 0),
    venta         REAL    NOT NULL DEFAULT 0 CHECK (venta >= 0),
    unidad_medida TEXT    NOT NULL DEFAULT '',
    estatus       TEXT    NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'inactivo'))
);

-- -----------------------------------------------------------------------------
-- ventas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    fecha      TEXT    NOT NULL,
    cliente_id TEXT    NOT NULL,
    total      REAL    NOT NULL CHECK (total >= 0),
    estado     TEXT    NOT NULL DEFAULT 'pendiente',
    tipo_pago  TEXT    NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- -----------------------------------------------------------------------------
-- pagos_venta
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos_venta (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_venta     TEXT    NOT NULL,
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
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_venta (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_venta         TEXT    NOT NULL,
    producto_id      TEXT    NOT NULL,
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
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creditos (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_venta        TEXT    NOT NULL UNIQUE,
    saldo_pendiente REAL    NOT NULL DEFAULT 0 CHECK (saldo_pendiente >= 0),
    FOREIGN KEY (id_venta) REFERENCES ventas(id)
);

-- -----------------------------------------------------------------------------
-- abonos_credito
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abonos_credito (
    id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_credito     TEXT    NOT NULL,
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
-- compras
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    fecha               TEXT    NOT NULL DEFAULT (date('now')),
    proveedor           TEXT    NOT NULL,
    monto_total         REAL    NOT NULL DEFAULT 0 CHECK (monto_total >= 0)
);

-- -----------------------------------------------------------------------------
-- detalle_compra
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_compra (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_compra        TEXT NOT NULL,
    producto_id      TEXT NOT NULL,
    codigo_producto  TEXT    NOT NULL,
    nombre_producto  TEXT    NOT NULL,
    costo            REAL    NOT NULL DEFAULT 0 CHECK (costo >= 0),
    cantidad         REAL    NOT NULL DEFAULT 0 CHECK (cantidad > 0),
    subtotal         REAL    GENERATED ALWAYS AS (costo * cantidad) STORED,
    FOREIGN KEY (id_compra) REFERENCES compras(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- -----------------------------------------------------------------------------
-- seriales
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seriales (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    producto_id      TEXT NOT NULL,
    serial           TEXT    NOT NULL UNIQUE,
    estado           TEXT    NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'vendido', 'garantia', 'devuelto')),
    id_compra        TEXT,
    id_venta         TEXT,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (id_compra) REFERENCES compras(id),
    FOREIGN KEY (id_venta) REFERENCES ventas(id)
);

-- -----------------------------------------------------------------------------
-- cargas_productos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cargas_productos (
    id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    fecha               TEXT    NOT NULL DEFAULT (date('now')),
    proveedor           TEXT    NOT NULL,
    monto_total         REAL    NOT NULL DEFAULT 0 CHECK (monto_total >= 0),
    productos_previos   REAL    NOT NULL DEFAULT 0 CHECK (productos_previos >= 0),
    productos_agregados REAL    NOT NULL DEFAULT 0 CHECK (productos_agregados >= 0)
);

-- -----------------------------------------------------------------------------
-- detalle_carga_productos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_carga_productos (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_carga         TEXT    NOT NULL,
    codigo_producto  TEXT    NOT NULL,
    nombre_producto  TEXT    NOT NULL,
    costo            REAL    NOT NULL DEFAULT 0 CHECK (costo >= 0),
    unidades_nuevas  REAL    NOT NULL DEFAULT 0 CHECK (unidades_nuevas >= 0),
    FOREIGN KEY (id_carga) REFERENCES cargas_productos(id)
);

-- -----------------------------------------------------------------------------
-- movimientos_inventario
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    producto_id     TEXT    NOT NULL,
    codigo_producto TEXT    NOT NULL,
    nombre_producto TEXT    NOT NULL,
    tipo            TEXT    NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    cantidad        REAL    NOT NULL CHECK (cantidad > 0),
    stock_antes     REAL    NOT NULL,
    stock_despues   REAL    NOT NULL CHECK (stock_despues >= 0),
    motivo          TEXT    NOT NULL,
    usuario_id      TEXT    NOT NULL,
    usuario_nombre  TEXT    NOT NULL,
    fecha           TEXT    NOT NULL,
    hora            TEXT    NOT NULL,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)
);

-- -----------------------------------------------------------------------------
-- devoluciones
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devoluciones (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_venta          TEXT    NOT NULL,
    cliente_id        TEXT    NOT NULL,
    monto_total       REAL    NOT NULL CHECK (monto_total > 0),
    tipo_resolucion   TEXT    NOT NULL CHECK (tipo_resolucion IN ('EFECTIVO', 'NOTA_CREDITO')),
    saldo_disponible  REAL    NOT NULL DEFAULT 0 CHECK (saldo_disponible >= 0),
    motivo            TEXT    NOT NULL DEFAULT '',
    fecha_creacion    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_venta)   REFERENCES ventas(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- -----------------------------------------------------------------------------
-- detalle_devolucion
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_devolucion (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_devolucion    TEXT    NOT NULL,
    producto_id      TEXT    NOT NULL,
    codigo_producto  TEXT    NOT NULL,
    nombre_producto  TEXT    NOT NULL,
    precio_unitario  REAL    NOT NULL,
    cantidad         REAL    NOT NULL CHECK (cantidad > 0),
    subtotal         REAL    GENERATED ALWAYS AS (precio_unitario * cantidad) STORED,
    FOREIGN KEY (id_devolucion) REFERENCES devoluciones(id),
    FOREIGN KEY (producto_id)   REFERENCES productos(id)
);

-- -----------------------------------------------------------------------------
-- cotizaciones
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotizaciones (
    id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    fecha              TEXT    NOT NULL,
    cliente_nombre     TEXT    NOT NULL,
    cliente_cedula_rif TEXT    NOT NULL,
    cliente_telefono   TEXT    NOT NULL,
    cliente_direccion  TEXT    NOT NULL,
    total              REAL    NOT NULL CHECK (total >= 0)
);

-- -----------------------------------------------------------------------------
-- detalle_cotizacion
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_cotizacion (
    id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    id_cotizacion    TEXT    NOT NULL,
    producto_id      TEXT    NOT NULL,
    codigo_producto  TEXT    NOT NULL,
    nombre_producto  TEXT    NOT NULL,
    precio_unitario  REAL    NOT NULL CHECK (precio_unitario >= 0),
    cantidad         REAL    NOT NULL CHECK (cantidad > 0),
    subtotal         REAL    GENERATED ALWAYS AS (precio_unitario * cantidad) STORED,
    FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- -----------------------------------------------------------------------------
-- bitacora
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    fecha           TEXT    NOT NULL,
    hora            TEXT    NOT NULL,
    usuario_id      TEXT,
    usuario_nombre  TEXT    NOT NULL,
    accion          TEXT    NOT NULL,
    entidad         TEXT,
    entidad_id      TEXT,
    detalle         TEXT    NOT NULL DEFAULT '',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- -----------------------------------------------------------------------------
-- Índices
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

CREATE INDEX IF NOT EXISTS idx_detalle_compra         ON detalle_compra(id_compra);
CREATE INDEX IF NOT EXISTS idx_seriales_producto      ON seriales(producto_id);

CREATE INDEX IF NOT EXISTS idx_detalle_carga          ON detalle_carga_productos(id_carga);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto   ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha      ON movimientos_inventario(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo       ON movimientos_inventario(tipo);

CREATE INDEX IF NOT EXISTS idx_devoluciones_venta     ON devoluciones(id_venta);
CREATE INDEX IF NOT EXISTS idx_devoluciones_cliente   ON devoluciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_tipo      ON devoluciones(tipo_resolucion);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha     ON devoluciones(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_detalle_devolucion     ON detalle_devolucion(id_devolucion);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha            ON cotizaciones(fecha);
CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_cotizacion ON detalle_cotizacion(id_cotizacion);
CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_producto   ON detalle_cotizacion(producto_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_fecha   ON bitacora(fecha);
CREATE INDEX IF NOT EXISTS idx_bitacora_accion  ON bitacora(accion);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario ON bitacora(usuario_id);
