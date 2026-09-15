import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { withTransaction, executeInTx } from '@/utils/dbTransaction';
import {
    parsearItemCotizacion,
    verificarProductoExiste,
    insertarDetalleCotizacion,
    validarDatosClienteCotizacion,
    calcularTotalCotizacion,
    normalizarId,
} from '@/utils/cotizacionValidaciones';
import { ACCIONES, registrarBitacoraEnTx } from '@/utils/bitacora.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function POST({ request }) {
    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: jsonHeaders });
    }

    try {
        const body = await request.json();
        const {
            fecha,
            clienteNombre,
            clienteCedulaRif,
            clienteTelefono,
            clienteDireccion,
            productos,
        } = body;

        if (!fecha) {
            return new Response(JSON.stringify({ error: 'Faltan datos de la cotización' }), { status: 400, headers: jsonHeaders });
        }

        const validacionCliente = validarDatosClienteCotizacion({
            clienteNombre,
            clienteCedulaRif,
            clienteTelefono,
            clienteDireccion,
        });

        if (!validacionCliente.ok) {
            return new Response(JSON.stringify({ error: validacionCliente.error }), { status: 400, headers: jsonHeaders });
        }

        if (!Array.isArray(productos) || productos.length === 0) {
            return new Response(JSON.stringify({ error: 'La cotización debe incluir al menos un producto' }), { status: 400, headers: jsonHeaders });
        }

        const itemsParseados = [];
        for (const producto of productos) {
            const parsed = parsearItemCotizacion(producto);
            if (!parsed.ok) {
                return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: jsonHeaders });
            }
            itemsParseados.push(parsed.item);
        }

        const totalCalculado = calcularTotalCotizacion(itemsParseados);

        if (totalCalculado <= 0) {
            return new Response(JSON.stringify({ error: 'El total de la cotización debe ser mayor a cero' }), { status: 400, headers: jsonHeaders });
        }

        const { nombre, cedulaRif, telefono, direccion } = validacionCliente.cliente;

        const cotizacionId = await withTransaction(db, async (tx) => {
            const itemsConfirmados = [];

            for (const item of itemsParseados) {
                const existe = await verificarProductoExiste(tx, item.productoId);
                if (!existe.ok) {
                    throw Object.assign(new Error(existe.error), { status: 404 });
                }

                itemsConfirmados.push({
                    ...item,
                    productoId: existe.producto.id,
                    codigo: existe.producto.codigo,
                    nombre: existe.producto.nombre,
                });
            }

            const cotizacionResult = await executeInTx(
                tx,
                `INSERT INTO cotizaciones
                    (fecha, cliente_nombre, cliente_cedula_rif, cliente_telefono, cliente_direccion, total)
                 VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
                [fecha, nombre, cedulaRif, telefono, direccion, totalCalculado]
            );

            const idCotizacion = normalizarId(cotizacionResult.rows[0].id);

            for (const item of itemsConfirmados) {
                await insertarDetalleCotizacion(tx, idCotizacion, item);
            }

            await registrarBitacoraEnTx(tx, {
                usuario,
                accion: ACCIONES.COTIZACION,
                entidad: 'cotizaciones',
                entidadId: idCotizacion,
                detalle: `Cotización #${idCotizacion} · ${nombre} · total ${totalCalculado}`,
            });

            return idCotizacion;
        });

        return new Response(
            JSON.stringify({
                message: 'Cotización registrada exitosamente',
                cotizacionId,
                total: totalCalculado,
            }),
            { status: 201, headers: jsonHeaders }
        );
    } catch (error) {
        const status = error.status ?? 500;
        const message = status === 500 ? 'Error al registrar la cotización' : error.message;

        if (status === 500) {
            console.error('Error registrando cotización completa:', error);
        }

        return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
    }
}
