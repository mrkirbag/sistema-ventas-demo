import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

const statements = [
    `CREATE TABLE IF NOT EXISTS movimientos_inventario (
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
    )`,
    'CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id)',
    'CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(fecha)',
    'CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_inventario(tipo)',
];

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    for (const sql of statements) {
        await db.execute(sql);
    }

    console.log('Tabla movimientos_inventario lista.');
}

migrate().catch((err) => {
    console.error('Error en migración de movimientos:', err.message);
    process.exit(1);
});
