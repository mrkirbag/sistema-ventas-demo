import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function getDb() {
    const url = process.env.DATABASE_URL;

    if (!url) {
        throw new Error('Falta DATABASE_URL en .env');
    }

    return createClient({
        url,
        authToken: process.env.DATABASE_AUTH_TOKEN,
    });
}

const ADMIN = {
    usuario: process.env.SEED_ADMIN_USER ?? 'admin',
    contrasena: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
    nombre: process.env.SEED_ADMIN_NOMBRE ?? 'Administrador',
    rol: 'admin' as const,
};

const TASA_COP = Number(process.env.SEED_TASA ?? 4000);
const TASA_BS = Number(process.env.SEED_TASA_BS ?? 36.5);

const CLIENTE_MOSTRADOR = {
    nombre: process.env.SEED_CLIENTE_NOMBRE ?? 'Consumidor final',
    cedula: process.env.SEED_CLIENTE_CEDULA ?? 'V-00000000',
    telefono: process.env.SEED_CLIENTE_TELEFONO ?? '0000-0000000',
};

function statementsFromSql(sql: string) {
    return sql
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/--.*$/, ''))
        .join('\n')
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => /^(PRAGMA|CREATE|ALTER|INSERT|UPDATE|DELETE)\b/i.test(statement));
}

async function applySchema(client: Client) {
    const schema = readFileSync(join(root, 'src/lib/db.sql'), 'utf8');

    for (const sql of statementsFromSql(schema)) {
        await client.execute(sql);
    }

    console.log('Esquema aplicado (tablas e índices).');
}

async function ensureColumn(client: Client, table: string, column: string, definition: string) {
    try {
        await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`Columna ${table}.${column} creada.`);
    } catch (error) {
        const mensaje = String((error as Error).message || error);
        if (!/duplicate column/i.test(mensaje)) {
            throw error;
        }
    }
}

async function seedTasas(client: Client) {
    if (!Number.isFinite(TASA_COP) || TASA_COP <= 0) {
        throw new Error('SEED_TASA debe ser un número mayor a 0');
    }

    if (!Number.isFinite(TASA_BS) || TASA_BS < 0) {
        throw new Error('SEED_TASA_BS debe ser un número mayor o igual a 0');
    }

    await ensureColumn(client, 'tasa', 'bs', 'REAL NOT NULL DEFAULT 0');

    await client.execute({
        sql: `
            INSERT INTO tasa (id, valor, bs) VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                valor = CASE WHEN tasa.valor = 0 THEN excluded.valor ELSE tasa.valor END,
                bs = CASE WHEN tasa.bs = 0 THEN excluded.bs ELSE tasa.bs END
        `,
        args: [TASA_COP, TASA_BS],
    });

    const actual = await client.execute('SELECT valor, bs FROM tasa WHERE id = 1');
    const row = actual.rows[0];

    console.log(`Tasa COP: ${Number(row?.valor) || TASA_COP}`);
    console.log(`Tasa Bs: ${Number(row?.bs) || TASA_BS}`);
}

async function seedAdmin(client: Client) {
    const existente = await client.execute({
        sql: 'SELECT id FROM usuarios WHERE usuario = ?',
        args: [ADMIN.usuario],
    });

    if (existente.rows.length > 0) {
        console.log(`Usuario "${ADMIN.usuario}" ya existe.`);
        return;
    }

    const hash = await bcrypt.hash(ADMIN.contrasena, 10);
    await client.execute({
        sql: 'INSERT INTO usuarios (usuario, clave, rol, nombre) VALUES (?, ?, ?, ?)',
        args: [ADMIN.usuario, hash, ADMIN.rol, ADMIN.nombre],
    });

    console.log(`Admin "${ADMIN.usuario}" creado.`);
}

async function seedClienteMostrador(client: Client) {
    const existente = await client.execute({
        sql: 'SELECT id FROM clientes WHERE cedula = ?',
        args: [CLIENTE_MOSTRADOR.cedula],
    });

    if (existente.rows.length > 0) {
        console.log(`Cliente "${CLIENTE_MOSTRADOR.nombre}" ya existe.`);
        return;
    }

    await client.execute({
        sql: 'INSERT INTO clientes (nombre, telefono, cedula, estatus) VALUES (?, ?, ?, ?)',
        args: [CLIENTE_MOSTRADOR.nombre, CLIENTE_MOSTRADOR.telefono, CLIENTE_MOSTRADOR.cedula, 'activo'],
    });

    console.log(`Cliente "${CLIENTE_MOSTRADOR.nombre}" creado.`);
}

async function seed() {
    const db = getDb();

    await applySchema(db);
    await seedTasas(db);
    await seedAdmin(db);
    await seedClienteMostrador(db);

    console.log('Seed completado.');
}

seed().catch((err: unknown) => {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error('Error en seed:', mensaje);
    process.exit(1);
});
