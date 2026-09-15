import { db } from '../db.js';
import { verificarToken } from '@/utils/auth';
import { ETIQUETAS_ACCION } from '@/utils/bitacora.js';

const LIMITE_MAXIMO = 400;

export async function GET({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    try {
        await db.execute(`
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
            )
        `);

        const url = new URL(request.url);
        const fecha = url.searchParams.get('fecha');
        const limit = Math.min(parseInt(url.searchParams.get('limit')) || LIMITE_MAXIMO, LIMITE_MAXIMO);

        let result;
        if (fecha && fecha.trim() !== '') {
            result = await db.execute({
                sql: `SELECT * FROM bitacora WHERE fecha = ? ORDER BY fecha DESC, hora DESC`,
                args: [fecha.trim()],
            });
        } else {
            result = await db.execute({
                sql: `SELECT * FROM bitacora ORDER BY fecha DESC, hora DESC LIMIT ?`,
                args: [limit],
            });
        }

        const registros = (result.rows || []).map((row) => ({
            ...row,
            etiqueta: ETIQUETAS_ACCION[row.accion] || row.accion,
        }));

        return new Response(JSON.stringify(registros), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error fetching bitácora:', error);
        return new Response(JSON.stringify({ error: 'Error al cargar la bitácora' }), { status: 500 });
    }
}
