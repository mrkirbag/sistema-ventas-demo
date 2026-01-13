import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function POST({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, fecha, montoAbono } = body;

        // Validar datos
        if (!id || !fecha || isNaN(montoAbono) || montoAbono <= 0) {
            return new Response(JSON.stringify({ message: 'Datos inválidos' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400
            });
        }

        // Traer el credito
        const credito = await db.execute('SELECT saldo_pendiente, id_venta FROM creditos WHERE id = ?',[id]);

        // Validar credito
        if (!credito?.rows?.length) {
            return new Response(JSON.stringify({ message: 'Crédito no encontrado' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 404
            });
        }

        // Actualizar el saldo pendiente del credito
        const { saldo_pendiente, id_venta } = credito.rows[0];
        const saldoActual = Number(saldo_pendiente);
        const nuevoSaldo = saldoActual - montoAbono;

        // Validar que el abono no exceda el saldo
        if (montoAbono > saldo_pendiente) {
            return new Response('El abono excede el saldo pendiente', { status: 409 });
        }

        // Agregar el abono
        await db.execute('INSERT INTO abonos_credito (id_credito, fecha, monto) VALUES (?, ?, ?)',[id, fecha, montoAbono]);

        // Actualizar saldo pendiente en el credito
        await db.execute('UPDATE creditos SET saldo_pendiente = ? WHERE id = ?',[nuevoSaldo, id]);

        let ventaActualizada = false;

        // Si el saldo llega a 0, marcar la venta como completada
        if (nuevoSaldo <= 0 && id_venta) {
            await db.execute('UPDATE ventas SET estado = ? WHERE id = ?', ['completado', id_venta]);
            ventaActualizada = true;
        }

        // Respuesta final
        return new Response(JSON.stringify({
            message: 'Abono registrado correctamente',
            saldo_pendiente: nuevoSaldo,
            venta_actualizada: ventaActualizada
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error al registrar abono:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
        });
}
}