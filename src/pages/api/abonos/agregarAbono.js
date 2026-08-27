import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { executeInTx, withTransaction } from '@/utils/dbTransaction';
import { obtenerMonedaBase } from '@/utils/helpers/tasas.js';
import { parsearLineaPago } from '@/utils/helpers/metodosPago.js';
import { ACCIONES, registrarBitacoraEnTx } from '@/utils/bitacora.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function tasasDelDia() {
    const result = await db.execute('SELECT valor, bs FROM tasa WHERE id = 1');
    const row = result.rows?.[0];
    return {
        cop: Number(row?.valor) || 0,
        bs: Number(row?.bs) || 0,
    };
}

export async function POST({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ message: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {
        const body = await request.json();
        const { id, fecha, moneda, metodo, monto } = body;
        const montoAbono = body.montoAbono ?? monto;

        if (!id || !fecha) {
            return new Response(JSON.stringify({ message: 'Datos inválidos' }), {
                headers: jsonHeaders,
                status: 400
            });
        }

        const tasas = await tasasDelDia();
        const monedaBase = obtenerMonedaBase();
        const linea = parsearLineaPago({
            moneda: moneda || 'USD',
            metodo,
            monto: montoAbono,
        }, monedaBase, tasas);

        if (!linea.ok) {
            return new Response(JSON.stringify({ message: linea.error }), {
                headers: jsonHeaders,
                status: 400
            });
        }

        const pago = linea.pago;

        const resultado = await withTransaction(db, async (tx) => {
            const credito = await executeInTx(
                tx,
                'SELECT saldo_pendiente, id_venta FROM creditos WHERE id = ?',
                [id]
            );

            if (!credito?.rows?.length) {
                throw Object.assign(new Error('Crédito no encontrado'), { status: 404 });
            }

            const { saldo_pendiente, id_venta } = credito.rows[0];
            const saldoActual = Number(saldo_pendiente);
            const montoBase = Number(pago.monto_base);

            if (montoBase > saldoActual + 0.51) {
                throw Object.assign(new Error('El abono excede el saldo pendiente'), { status: 409 });
            }

            const nuevoSaldo = Math.max(0, saldoActual - montoBase);

            await executeInTx(
                tx,
                `INSERT INTO abonos_credito
                    (id_credito, fecha, monto, moneda, metodo, monto_recibido, moneda_base, tasa_cop, tasa_bs)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    fecha,
                    montoBase,
                    pago.moneda,
                    pago.metodo,
                    pago.monto,
                    pago.moneda_base,
                    pago.tasa_cop,
                    pago.tasa_bs,
                ]
            );

            if (id_venta) {
                await executeInTx(
                    tx,
                    `INSERT INTO pagos_venta
                        (id_venta, moneda, metodo, monto, monto_base, moneda_base, tasa_cop, tasa_bs)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id_venta,
                        pago.moneda,
                        pago.metodo,
                        pago.monto,
                        pago.monto_base,
                        pago.moneda_base,
                        pago.tasa_cop,
                        pago.tasa_bs,
                    ]
                );
            }

            await executeInTx(
                tx,
                'UPDATE creditos SET saldo_pendiente = ? WHERE id = ?',
                [nuevoSaldo, id]
            );

            let ventaActualizada = false;

            if (nuevoSaldo <= 0.001 && id_venta) {
                await executeInTx(
                    tx,
                    'UPDATE ventas SET estado = ? WHERE id = ?',
                    ['completado', id_venta]
                );
                ventaActualizada = true;
            }

            await registrarBitacoraEnTx(tx, {
                usuario,
                accion: ACCIONES.ABONO,
                entidad: 'abonos_credito',
                entidadId: Number(id),
                detalle: `Crédito #${id} · abono ${montoBase} ${pago.moneda_base} · saldo ${nuevoSaldo}`,
            });

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
