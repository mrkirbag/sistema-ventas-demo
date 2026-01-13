import bcrypt from 'bcrypt';
import { db } from '../db.js'; 
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export async function POST({ request }) {

    const { usuario, clave } = await request.json();

    const result = await db.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    const user = result?.rows?.[0];

    if (!user) {
        return new Response(JSON.stringify({ error: 'Usuario o clave incorrectos' }), { status: 401 });
    }

    const claveValida = await bcrypt.compare(clave, user.clave);
    if (!claveValida) { 
        return new Response(JSON.stringify({ error: 'Usuario o clave incorrectos' }), { status: 401 });
    }

    // Genera el JWT
    const JWT_SECRET = import.meta.env.JWT_SECRET;
    const token = jwt.sign({ id: user.id, usuario: user.usuario, rol: user.rol, nombre: user.nombre }, JWT_SECRET, { expiresIn: '6h' });

    // Envía el token en una cookie HTTP-only
    return new Response(JSON.stringify({ mensaje: 'Login exitoso', rol: user.rol }), {
        status: 200,
        headers: {
            'Set-Cookie': `token=${token}; HttpOnly; Path=/; Max-Age=28800`, // 8 horas
            'Content-Type': 'application/json'
        }
    });
}
