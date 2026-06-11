import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { withTransaction } from '@/utils/dbTransaction';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function POST({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {
        const body = await request.json();
        const { id, fecha, montoAbono } = body;

        if (!id || !fecha || isNaN(montoAbono) || montoAbono <= 0) {
            return new Response(JSON.stringify({ message: 'Datos inválidos' }), {
                headers: jsonHeaders,
                status: 400
            });
        }

        const resultado = await withTransaction(db, async (tx) => {
            const credito = await tx.execute(
                'SELECT saldo_pendiente, id_venta FROM creditos WHERE id = ?',
                [id]
            );

            if (!credito?.rows?.length) {
                throw Object.assign(new Error('Crédito no encontrado'), { status: 404 });
            }

            const { saldo_pendiente, id_venta } = credito.rows[0];
            const saldoActual = Number(saldo_pendiente);
            const monto = Number(montoAbono);

            if (monto > saldoActual + 0.001) {
                throw Object.assign(new Error('El abono excede el saldo pendiente'), { status: 409 });
            }

            const nuevoSaldo = Math.max(0, saldoActual - monto);

            await tx.execute(
                'INSERT INTO abonos_credito (id_credito, fecha, monto) VALUES (?, ?, ?)',
                [id, fecha, monto]
            );

            await tx.execute(
                'UPDATE creditos SET saldo_pendiente = ? WHERE id = ?',
                [nuevoSaldo, id]
            );

            let ventaActualizada = false;

            if (nuevoSaldo <= 0.001 && id_venta) {
                await tx.execute(
                    'UPDATE ventas SET estado = ? WHERE id = ?',
                    ['completado', id_venta]
                );
                ventaActualizada = true;
            }

            return { nuevoSaldo, ventaActualizada };
        });

        return new Response(JSON.stringify({
            message: 'Abono registrado correctamente',
            saldo_pendiente: resultado.nuevoSaldo,
            venta_actualizada: resultado.ventaActualizada
        }), {
            headers: jsonHeaders,
            status: 200
        });

    } catch (error) {
        const status = error.status ?? 500;
        const message = status === 500 ? 'Error interno del servidor' : error.message;

        if (status === 500) {
            console.error('Error al registrar abono:', error);
        }

        return new Response(JSON.stringify({ message }), {
            headers: jsonHeaders,
            status
        });
    }
}
