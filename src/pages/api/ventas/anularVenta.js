import { db } from '../db.js';
import { verificarToken } from '@/utils/auth';
import { withTransaction } from '@/utils/dbTransaction';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function POST({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Solo administradores pueden anular ventas' }), { status: 403, headers: jsonHeaders });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || isNaN(Number(id))) {
        return new Response(JSON.stringify({ error: 'ID inválido' }), {
            status: 400,
            headers: jsonHeaders
        });
    }

    try {

        await withTransaction(db, async (tx) => {
            const ventaCheck = await tx.execute(
                'SELECT estado, tipo_pago FROM ventas WHERE id = ?',
                [id]
            );

            if (!ventaCheck.rows?.length) {
                throw Object.assign(new Error('Venta no encontrada'), { status: 404 });
            }

            const validarVenta = ventaCheck.rows[0];

            if (validarVenta.estado === 'anulado') {
                throw Object.assign(new Error('Venta ya está anulada'), { status: 409 });
            }

            const credito = await tx.execute(
                'SELECT id, saldo_pendiente FROM creditos WHERE id_venta = ?',
                [id]
            );

            if (credito.rows?.length) {
                const { id: idCredito, saldo_pendiente } = credito.rows[0];

                const abonos = await tx.execute(
                    'SELECT COUNT(*) AS total FROM abonos_credito WHERE id_credito = ?',
                    [idCredito]
                );

                const totalAbonos = Number(abonos.rows[0]?.total ?? 0);

                if (totalAbonos > 0) {
                    throw Object.assign(
                        new Error('No se puede anular una venta a crédito con abonos registrados'),
                        { status: 409 }
                    );
                }

                await tx.execute(
                    'UPDATE creditos SET saldo_pendiente = 0 WHERE id = ?',
                    [idCredito]
                );
            }

            await tx.execute(
                'UPDATE ventas SET estado = ? WHERE id = ?',
                ['anulado', id]
            );

            const productos = await tx.execute(
                'SELECT codigo_producto, cantidad FROM detalle_venta WHERE id_venta = ?',
                [id]
            );

            for (const { codigo_producto, cantidad } of productos.rows) {
                await tx.execute(
                    'UPDATE productos SET stock = stock + ? WHERE codigo = ?',
                    [cantidad, codigo_producto]
                );
            }
        });

        return new Response(JSON.stringify({ message: 'Venta anulada correctamente' }), {
            headers: jsonHeaders
        });

    } catch (err) {
        const status = err.status ?? 500;
        const message = status === 500 ? 'Error interno del servidor' : err.message;

        if (status === 500) {
            console.error('Error anulando venta:', err);
        }

        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: jsonHeaders
        });
    }
}
