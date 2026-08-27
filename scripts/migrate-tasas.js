import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    try {
        await db.execute('ALTER TABLE tasa ADD COLUMN bs REAL NOT NULL DEFAULT 0');
        console.log('Columna tasa.bs creada.');
    } catch (error) {
        const mensaje = String(error.message || error);

        if (mensaje.toLowerCase().includes('duplicate column')) {
            console.log('La columna tasa.bs ya existe.');
        } else {
            throw error;
        }
    }
}

migrate().catch((err) => {
    console.error('Error en migración de tasas:', err.message);
    process.exit(1);
});
