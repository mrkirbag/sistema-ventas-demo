/**
 * Migración: Crear tablas `devoluciones` y `detalle_devolucion`
 * Ejecutar: node scripts/migrate-devoluciones.js
 */
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

const TABLA_DEVOLUCIONES = `
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
    )
`;

const TABLA_DETALLE_DEVOLUCION = `
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
    )
`;

const INDICES = [
    'CREATE INDEX IF NOT EXISTS idx_devoluciones_venta    ON devoluciones(id_venta)',
    'CREATE INDEX IF NOT EXISTS idx_devoluciones_cliente  ON devoluciones(cliente_id)',
    'CREATE INDEX IF NOT EXISTS idx_devoluciones_tipo     ON devoluciones(tipo_resolucion)',
    'CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha    ON devoluciones(fecha_creacion)',
    'CREATE INDEX IF NOT EXISTS idx_detalle_devolucion    ON detalle_devolucion(id_devolucion)',
];

async function migrate() {
    console.log('⏳ Creando tabla devoluciones...');
    await db.execute(TABLA_DEVOLUCIONES);

    console.log('⏳ Creando tabla detalle_devolucion...');
    await db.execute(TABLA_DETALLE_DEVOLUCION);

    console.log('⏳ Creando índices...');
    for (const idx of INDICES) {
        await db.execute(idx);
    }

    console.log('✅ Migración de devoluciones completada.');
}

migrate().catch((err) => {
    console.error('❌ Error en migración:', err);
    process.exit(1);
});
