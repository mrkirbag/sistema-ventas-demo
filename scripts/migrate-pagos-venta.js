import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

const statements = [
    `CREATE TABLE IF NOT EXISTS pagos_venta (
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
    )`,
    'CREATE INDEX IF NOT EXISTS idx_pagos_venta_venta ON pagos_venta(id_venta)',
    'CREATE INDEX IF NOT EXISTS idx_pagos_venta_metodo ON pagos_venta(moneda, metodo)',
];

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    for (const sql of statements) {
        await db.execute(sql);
    }

    console.log('Tabla pagos_venta lista.');
}

migrate().catch((err) => {
    console.error('Error en migración de pagos de venta:', err.message);
    process.exit(1);
});
