import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { registrarMovimientoInventario } from '@/utils/inventarioMovimientos.js';

export async function PUT({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('No autorizado', { status: 401 });
    } 
    if (usuario.rol !== 'admin'){
        return new Response('No autorizado', { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, stockNumero, motivo } = body;

        const resultado = await registrarMovimientoInventario(db, {
            productoId: id,
            tipo: 'entrada',
            cantidad: stockNumero,
            motivo,
            usuario,
        });

        return new Response(JSON.stringify({ message: 'Stock actualizado correctamente', stock: resultado.stock }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) {
            console.error('Error fetching producto:', error);
        }

        return new Response(JSON.stringify({ error: error.message || 'Error al actualizar stock' }), {
            headers: { 'Content-Type': 'application/json' },
            status,
        });
    }
}
