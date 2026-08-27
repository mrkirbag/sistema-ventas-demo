import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { ACCIONES, registrarBitacora } from '@/utils/bitacora.js';

function payloadTasa(row) {
    const cop = Number(row?.valor) || 0;
    const bs = Number(row?.bs) || 0;

    return {
        id: row.id,
        valor: cop,
        cop,
        bs,
    };
}

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
        
        return new Response(JSON.stringify(payloadTasa(tasa.rows[0])), {
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
        const cop = Number(body.cop ?? body.tasa);
        const bs = Number(body.bs);

        if (!Number.isFinite(cop) || cop <= 0) {
            return new Response(JSON.stringify({ error: 'La tasa COP debe ser un número mayor a 0' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400
            });
        }

        if (!Number.isFinite(bs) || bs < 0) {
            return new Response(JSON.stringify({ error: 'La tasa Bs debe ser un número mayor o igual a 0' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400
            });
        }

        const result = await db.execute('UPDATE tasa SET valor = ?, bs = ? WHERE id = 1', [cop, bs]);

        if (result.affectedRows === 0) {
            return new Response('Tasa no encontrado', { status: 404 });
        }

        await registrarBitacora(db, {
            usuario,
            accion: ACCIONES.TASA,
            entidad: 'tasa',
            entidadId: 1,
            detalle: `COP ${cop} · Bs ${bs}`,
        });

        return new Response(JSON.stringify({ message: "Tasa actualizado exitosamente" }), { status: 200 });

    } catch (error) {
        console.error('Error updating tasa:', error);
        return new Response('Error updating tasa', { status: 500 });
    }
}
