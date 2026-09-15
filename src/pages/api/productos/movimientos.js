import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { registrarMovimientoInventario } from '@/utils/inventarioMovimientos.js';

const LIMITE_MAXIMO = 500;

export async function GET({ request }) {
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    try {
        const url = new URL(request.url);
        const productoId = url.searchParams.get('productoId');
        const tipo = url.searchParams.get('tipo');
        const limit = Math.min(
            parseInt(url.searchParams.get('limit')) || LIMITE_MAXIMO,
            LIMITE_MAXIMO
        );

        const origen = url.searchParams.get('origen');

        const filtros = [];
        const args = [];

        if (productoId) {
            filtros.push('producto_id = ?');
            args.push(productoId);
        }

        if (tipo === 'entrada' || tipo === 'salida') {
            filtros.push('tipo = ?');
            args.push(tipo);
        }

        if (origen === 'ventas') {
            filtros.push(`(motivo LIKE 'Venta #%' OR motivo LIKE 'Devolución de venta #%')`);
        } else if (origen === 'otros') {
            filtros.push(`(motivo NOT LIKE 'Venta #%' AND motivo NOT LIKE 'Devolución de venta #%')`);
        }

        const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
        const result = await db.execute({
            sql: `SELECT * FROM movimientos_inventario ${where} ORDER BY fecha DESC, hora DESC LIMIT ?`,
            args: [...args, limit],
        });

        const filas = result.rows || [];

        if (filas.length === 0) {
            return new Response(JSON.stringify({ message: 'No hay movimientos registrados', movimientos: [] }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify(filas), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error fetching movimientos:', error);
        return new Response(JSON.stringify({ error: 'Error al cargar el historial' }), { status: 500 });
    }
}

export async function POST({ request }) {
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    try {
        const body = await request.json();
        const resultado = await registrarMovimientoInventario(db, {
            productoId: body.productoId ?? body.id,
            tipo: body.tipo,
            cantidad: body.cantidad ?? body.stockNumero,
            motivo: body.motivo,
            usuario,
            seriales: body.seriales,
        });

        const mensaje = resultado.tipo === 'salida'
            ? 'Salida de stock registrada'
            : 'Stock actualizado correctamente';

        return new Response(JSON.stringify({ message: mensaje, ...resultado }), {
            headers: { 'Content-Type': 'application/json' },
            status: 201,
        });
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) {
            console.error('Error registrando movimiento:', error);
        }

        return new Response(JSON.stringify({ error: error.message || 'Error al registrar el movimiento' }), {
            headers: { 'Content-Type': 'application/json' },
            status,
        });
    }
}
