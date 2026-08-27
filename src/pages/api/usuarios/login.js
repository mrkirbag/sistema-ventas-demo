import bcrypt from 'bcrypt';
import { db } from '../db.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { ACCIONES, registrarBitacora } from '@/utils/bitacora.js';
dotenv.config();

const SESION_SEGUNDOS = 8 * 60 * 60;

export async function POST({ request }) {

    const { usuario, clave } = await request.json();

    const result = await db.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    const user = result?.rows?.[0];

    if (!user) {
        return new Response(JSON.stringify({ error: 'Usuario o clave incorrectos' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const claveValida = await bcrypt.compare(clave, user.clave);
    if (!claveValida) {
        return new Response(JSON.stringify({ error: 'Usuario o clave incorrectos' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const sesion = { id: user.id, usuario: user.usuario, rol: user.rol, nombre: user.nombre };

    try {
        await registrarBitacora(db, {
            usuario: sesion,
            accion: ACCIONES.LOGIN,
            entidad: 'usuarios',
            entidadId: Number(user.id),
            detalle: `${user.nombre} (${user.usuario})`,
        });
    } catch (error) {
        console.error('No se pudo registrar el login en bitácora:', error);
    }

    const JWT_SECRET = import.meta.env.JWT_SECRET;
    const token = jwt.sign(sesion, JWT_SECRET, { expiresIn: `${SESION_SEGUNDOS}s` });

    return new Response(JSON.stringify({ mensaje: 'Login exitoso', rol: user.rol }), {
        status: 200,
        headers: {
            'Set-Cookie': `token=${token}; HttpOnly; Path=/; Max-Age=${SESION_SEGUNDOS}; SameSite=Lax`,
            'Content-Type': 'application/json',
        },
    });
}
