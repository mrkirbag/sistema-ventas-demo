import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

const statements = [
    `CREATE TABLE IF NOT EXISTS cotizaciones (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha              TEXT    NOT NULL,
        cliente_nombre     TEXT    NOT NULL,
        cliente_cedula_rif TEXT    NOT NULL,
        cliente_telefono   TEXT    NOT NULL,
        cliente_direccion  TEXT    NOT NULL,
        total              REAL    NOT NULL CHECK (total >= 0)
    )`,
    `CREATE TABLE IF NOT EXISTS detalle_cotizacion (
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
    )`,
    'CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON cotizaciones(fecha)',
    'CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_cotizacion ON detalle_cotizacion(id_cotizacion)',
    'CREATE INDEX IF NOT EXISTS idx_detalle_cotizacion_producto ON detalle_cotizacion(producto_id)',
];

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    for (const sql of statements) {
        await db.execute(sql);
    }

    console.log('Tablas de cotizaciones creadas correctamente.');
}

migrate().catch((err) => {
    console.error('Error en migración:', err.message);
    process.exit(1);
});
