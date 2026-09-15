import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

const statements = [
    `CREATE TABLE IF NOT EXISTS compras (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        fecha               TEXT    NOT NULL DEFAULT (date('now')),
        proveedor           TEXT    NOT NULL,
        monto_total         REAL    NOT NULL DEFAULT 0 CHECK (monto_total >= 0)
    )`,
    `CREATE TABLE IF NOT EXISTS detalle_compra (
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
    )`,
    `CREATE TABLE IF NOT EXISTS seriales (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        producto_id      TEXT NOT NULL,
        serial           TEXT    NOT NULL UNIQUE,
        estado           TEXT    NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'vendido', 'garantia', 'devuelto')),
        id_compra        TEXT,
        id_venta         TEXT,
        FOREIGN KEY (producto_id) REFERENCES productos(id),
        FOREIGN KEY (id_compra) REFERENCES compras(id),
        FOREIGN KEY (id_venta) REFERENCES ventas(id)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_detalle_compra ON detalle_compra(id_compra)',
    'CREATE INDEX IF NOT EXISTS idx_seriales_producto ON seriales(producto_id)',
];

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    for (const sql of statements) {
        await db.execute(sql);
    }

    console.log('Tablas de compras y seriales creadas correctamente.');
}

migrate().catch((err) => {
    console.error('Error en migración:', err.message);
    process.exit(1);
});
