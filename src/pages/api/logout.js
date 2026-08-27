import { db } from './db.js';
import { verificarToken } from '@/utils/auth';
import { ACCIONES, registrarBitacora } from '@/utils/bitacora.js';

export async function POST({ request }) {
    const usuario = verificarToken(request);

    if (usuario) {
        try {
            await registrarBitacora(db, {
                usuario,
                accion: ACCIONES.LOGOUT,
                entidad: 'usuarios',
                entidadId: Number(usuario.id) || null,
                detalle: `${usuario.nombre || usuario.usuario} (${usuario.usuario})`,
            });
        } catch (error) {
            console.error('No se pudo registrar el logout en bitácora:', error);
        }
    }

    return new Response(JSON.stringify({ mensaje: 'Sesión cerrada' }), {
        status: 200,
        headers: {
            'Set-Cookie': 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
            'Content-Type': 'application/json',
        },
    });
}
