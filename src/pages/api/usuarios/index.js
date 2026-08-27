import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { ACCIONES, registrarBitacora } from '@/utils/bitacora.js';

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
        const usuarios = await db.execute('SELECT id, usuario, rol, nombre FROM usuarios ORDER BY id ASC');

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

        if (Number(id) === Number(usuario.id)) {
            return new Response(JSON.stringify({ message: 'No puedes eliminar tu propia cuenta' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const objetivo = await db.execute(
            'SELECT id, usuario, nombre, rol FROM usuarios WHERE id = ?',
            [id]
        );
        const fila = objetivo.rows?.[0];

        if (!fila) {
            return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const movimientos = await db.execute(
            'SELECT COUNT(*) AS total FROM movimientos_inventario WHERE usuario_id = ?',
            [id]
        );

        if (Number(movimientos.rows?.[0]?.total ?? 0) > 0) {
            return new Response(JSON.stringify({
                error: 'No se puede eliminar el usuario porque tiene movimientos de inventario registrados',
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        await registrarBitacora(db, {
            usuario,
            accion: ACCIONES.USUARIO_ELIMINAR,
            entidad: 'usuarios',
            entidadId: Number(id),
            detalle: `${fila.nombre} (${fila.usuario}) · ${fila.rol}`,
        });

        await db.execute('UPDATE bitacora SET usuario_id = NULL WHERE usuario_id = ?', [id]);

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