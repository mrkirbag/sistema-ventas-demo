import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

const statements = [
    'ALTER TABLE abonos_credito ADD COLUMN moneda TEXT',
    'ALTER TABLE abonos_credito ADD COLUMN metodo TEXT',
    'ALTER TABLE abonos_credito ADD COLUMN monto_recibido REAL',
    'ALTER TABLE abonos_credito ADD COLUMN moneda_base TEXT',
    'ALTER TABLE abonos_credito ADD COLUMN tasa_cop REAL NOT NULL DEFAULT 0',
    'ALTER TABLE abonos_credito ADD COLUMN tasa_bs REAL NOT NULL DEFAULT 0',
];

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    for (const sql of statements) {
        try {
            await db.execute(sql);
        } catch (error) {
            const mensaje = String(error?.message || error);
            if (!/duplicate column|already exists/i.test(mensaje)) {
                throw error;
            }
        }
    }

    console.log('Columnas de método de pago en abonos_credito listas.');
}

migrate().catch((err) => {
    console.error('Error en migración de abonos:', err.message);
    process.exit(1);
});
