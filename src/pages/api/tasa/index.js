import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    // Autenticación y autorización
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    try {

        const tasa = await db.execute('SELECT * FROM tasa');

        // Si no hay tasa, retornar un mensaje de error
        if (!tasa || !tasa.rows || tasa.rows.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay tasa registrada' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 204
            });
        }
        
        // Retornar los clientes en formato JSON
        return new Response(JSON.stringify(tasa.rows[0]), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error fetching tasa:', error);
        return new Response('Error fetching tasa', { status: 500 });
    }
}

export async function PUT({ request }) {

    // Autenticación y autorización
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    try {
        const body = await request.json();
        const { tasa } = body;

        // Validar que el cliente tenga los campos necesarios
        if (!tasa) {
            return new Response('Faltan datos de la tasa', { status: 400 });
        }

        // Actualizar el cliente en la base de datos
        const result = await db.execute('UPDATE tasa SET valor = ? WHERE id = 1', [tasa]);

        // Validar si no se encuentra
        if (result.affectedRows === 0) {
            return new Response('Tasa no encontrado', { status: 404 });
        }

        return new Response(JSON.stringify({ message: "Tasa actualizado exitosamente" }), { status: 200 });

    } catch (error) {
        console.error('Error updating tasa:', error);
        return new Response('Error updating tasa', { status: 500 });
    }
}