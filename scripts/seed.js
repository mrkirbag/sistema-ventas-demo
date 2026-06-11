import { createClient } from '@libsql/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
});

const ADMIN = {
    usuario: process.env.SEED_ADMIN_USER ?? 'admin',
    contrasena: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
    nombre: process.env.SEED_ADMIN_NOMBRE ?? 'Administrador',
    rol: 'admin',
};

const TASA_INICIAL = Number(process.env.SEED_TASA ?? 40);

async function seed() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    await db.execute({
        sql: 'INSERT OR IGNORE INTO tasa (id, valor) VALUES (1, ?)',
        args: [TASA_INICIAL],
    });

    const existente = await db.execute({
        sql: 'SELECT id FROM usuarios WHERE usuario = ?',
        args: [ADMIN.usuario],
    });

    if (existente.rows.length > 0) {
        console.log(`Usuario "${ADMIN.usuario}" ya existe. Seed omitido.`);
    } else {
        const hash = await bcrypt.hash(ADMIN.contrasena, 10);
        await db.execute({
            sql: 'INSERT INTO usuarios (usuario, clave, rol, nombre) VALUES (?, ?, ?, ?)',
            args: [ADMIN.usuario, hash, ADMIN.rol, ADMIN.nombre],
        });
        console.log(`Admin "${ADMIN.usuario}" creado.`);
    }

    console.log(`Tasa inicial: ${TASA_INICIAL}`);
    console.log('Seed completado.');
}

seed().catch((err) => {
    console.error('Error en seed:', err.message);
    process.exit(1);
});
