import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    // Verificar autenticación
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response('Acceso denegado', { status: 403 });
    }

    try {
        const usuarios = await db.execute('SELECT * FROM usuarios ORDER BY id ASC');

        // Si no hay usuarios, retornar un mensaje de error
        if (!usuarios || !usuarios.rows || usuarios.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay usuarios registrados' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 204
            });
        }

        // Retornar los usuarios en formato JSON
        return new Response(JSON.stringify(usuarios.rows), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error fetching usuarios:', error);
        return new Response('Error fetching usuarios', { status: 500 });
    }
}

export async function DELETE({ request }) {

    // Verificar autenticación
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response('Acceso denegado', { status: 403 });
    }

    try {
        const { id } = await request.json();

        if (!id) {
            return new Response(JSON.stringify({ error: 'ID de usuario requerido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await db.execute('DELETE FROM usuarios WHERE id = ?', [id]);

        if (result.rowsAffected === 0) {
            return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ mensaje: 'Usuario eliminado correctamente' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        return new Response(JSON.stringify({ error: 'Error eliminando usuario' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}