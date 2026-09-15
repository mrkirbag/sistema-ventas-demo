import { db } from '../db.js';
import { verificarToken } from '@/utils/auth';
import { withTransaction, executeInTx } from '@/utils/dbTransaction';

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * POST /api/devoluciones/consumirCredito
 * Consume notas de crédito FIFO para pagar parcial o totalmente una nueva venta.
 *
 * Body: {
 *   cliente_id: number,
 *   id_venta: number,      // La venta que se está pagando
 *   monto_a_cubrir: number, // Cuánto se quiere pagar con notas de crédito
 *   moneda_base: string,    // Moneda base del comercio (ej. 'USD')
 *   tasa_cop: number,
 *   tasa_bs: number
 * }
 *
 * Respuesta: {
 *   monto_aplicado: number,  // Lo que realmente se pudo cubrir
 *   saldo_restante: number,  // Lo que queda por pagar por otros medios
 *   notas_consumidas: [{ id, monto_consumido }]
 * }
 */
export async function POST({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Body JSON inválido' }), { status: 400, headers: jsonHeaders });
    }

    const { cliente_id, id_venta, monto_a_cubrir, moneda_base, tasa_cop, tasa_bs } = body;

    // ── Validaciones ─────────────────────────────────────────────────────
    if (!cliente_id ) {
        return new Response(JSON.stringify({ error: 'ID de cliente inválido' }), { status: 400, headers: jsonHeaders });
    }

    if (!id_venta ) {
        return new Response(JSON.stringify({ error: 'ID de venta inválido' }), { status: 400, headers: jsonHeaders });
    }

    const montoCubrir = Number(monto_a_cubrir);
    if (!montoCubrir || montoCubrir <= 0) {
        return new Response(JSON.stringify({ error: 'Monto a cubrir debe ser mayor a cero' }), { status: 400, headers: jsonHeaders });
    }

    try {
        const resultado = await withTransaction(db, async (tx) => {

            // ── 1. Obtener notas de crédito disponibles (FIFO) ───────────
            const notasResult = await executeInTx(
                tx,
                `SELECT id, saldo_disponible
                 FROM devoluciones
                 WHERE cliente_id = ?
                   AND tipo_resolucion = 'NOTA_CREDITO'
                   AND saldo_disponible > 0
                 ORDER BY fecha_creacion ASC`,
                [cliente_id]
            );

            if (!notasResult.rows?.length) {
                throw Object.assign(
                    new Error('El cliente no tiene notas de crédito disponibles'),
                    { status: 404 }
                );
            }

            // ── 2. Consumir FIFO ─────────────────────────────────────────
            let restante = montoCubrir;
            const notasConsumidas = [];

            for (const nota of notasResult.rows) {
                if (restante <= 0) break;

                const saldoNota = Number(nota.saldo_disponible);
                const consumir = Math.min(saldoNota, restante);
                const nuevoSaldo = +(saldoNota - consumir).toFixed(2);

                await executeInTx(
                    tx,
                    'UPDATE devoluciones SET saldo_disponible = ? WHERE id = ?',
                    [nuevoSaldo, nota.id]
                );

                notasConsumidas.push({
                    id: nota.id,
                    monto_consumido: consumir,
                });

                restante = +(restante - consumir).toFixed(2);
            }

            const montoAplicado = +(montoCubrir - restante).toFixed(2);

            // ── 3. Registrar como pago de la venta ───────────────────────
            if (montoAplicado > 0) {
                await executeInTx(
                    tx,
                    `INSERT INTO pagos_venta
                        (id_venta, moneda, metodo, monto, monto_base, moneda_base, tasa_cop, tasa_bs)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id_venta,
                        moneda_base || 'USD',
                        'nota_credito',
                        montoAplicado,
                        montoAplicado,
                        moneda_base || 'USD',
                        tasa_cop || 0,
                        tasa_bs || 0,
                    ]
                );
            }

            return {
                monto_aplicado: montoAplicado,
                saldo_restante: restante,
                notas_consumidas: notasConsumidas,
            };
        });

        return new Response(JSON.stringify(resultado), { headers: jsonHeaders });

    } catch (err) {
        const status = err.status ?? 500;
        const message = status === 500 ? 'Error interno del servidor' : err.message;

        if (status === 500) {
            console.error('Error consumiendo crédito:', err);
        }

        return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
    }
}
