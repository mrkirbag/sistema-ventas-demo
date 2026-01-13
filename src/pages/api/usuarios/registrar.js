import bcrypt from 'bcrypt';  
import { db } from '../db.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export async function POST({ request }) {

    // Verifica el JWT y el rol
    const cookie = request.headers.get('cookie');
    if (!cookie) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const token = cookie.split('token=')[1]?.split(';')[0];
    if (!token) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    let payload;

    try {
        const JWT_SECRET = import.meta.env.JWT_SECRET;
        payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 });
    }

    if (payload.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Solo admin puede registrar usuarios' }), { status: 403 });
    }

    const {  nombre, usuario, contrasena, rol } = await request.json();

    // Hashea la contraseña
    const contrasenaHasheada = await bcrypt.hash(contrasena, 10);

    // Inserta el usuario en la base de datos
    try {

        await db.execute('INSERT INTO usuarios (usuario, clave, rol, nombre) VALUES (?, ?, ?, ?)', [usuario, contrasenaHasheada, rol, nombre]);

        return new Response(JSON.stringify({ mensaje: 'Usuario registrado correctamente' }), { status: 201 });
        
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Error al registrar usuario', detalle: err.message }), { status: 500 });
    }
}