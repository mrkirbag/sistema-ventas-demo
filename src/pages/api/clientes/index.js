import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import { documentoComparable, validarCliente } from '@/utils/clienteValidaciones.js';
import { ACCIONES, registrarBitacora } from '@/utils/bitacora.js';

const jsonHeaders = { 'Content-Type': 'application/json' };
const LIMITE_BUSQUEDA = 50;
const LIMITE_LISTA = 500;
const LIMITE_MAXIMO = 500;
const CLIENTE_ACTIVO = `IFNULL(estatus, 'activo') = 'activo'`;

function serializarCliente(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        telefono: row.telefono,
        cedula: row.cedula,
        estatus: row.estatus || 'activo',
    };
}

function idNumerico(valor) {
    return valor ? String(valor) : null;
}

async function marcarClienteActivo(id) {
    try {
        await db.execute({
            sql: 'UPDATE clientes SET estatus = ? WHERE id = ?',
            args: ['activo', id],
        });
    } catch (error) {
        console.warn('No se pudo forzar estatus activo del cliente:', error);
    }
}

async function insertarClienteActivo(nombre, telefono, cedula) {
    try {
        const insert = await db.execute({
            sql: `INSERT INTO clientes (nombre, telefono, cedula, estatus)
                  VALUES (?, ?, ?, ?)
                  RETURNING id, nombre, telefono, cedula, estatus`,
            args: [nombre, telefono, cedula, 'activo'],
        });

        const fila = insert.rows?.[0];
        const id = idNumerico(fila?.id);
        if (!id) {
            throw new Error('No se obtuvo el ID del cliente insertado');
        }

        await marcarClienteActivo(id);
        return (await obtenerClientePorId(id)) ?? serializarCliente({ ...fila, id, estatus: 'activo' });
    } catch (error) {
        const yaGuardado = await buscarClientePorDocumento(cedula);
        if (yaGuardado) {
            const id = idNumerico(yaGuardado.id);
            if (id) await marcarClienteActivo(id);
            return id ? await obtenerClientePorId(id) : serializarCliente(yaGuardado);
        }

        const insert = await db.execute({
            sql: 'INSERT INTO clientes (nombre, telefono, cedula) VALUES (?, ?, ?) RETURNING id',
            args: [nombre, telefono, cedula],
        });
        const id = idNumerico(insert.rows?.[0]?.id)
            ?? idNumerico((await db.execute({
                sql: 'SELECT id FROM clientes WHERE cedula = ?',
                args: [cedula],
            })).rows?.[0]?.id);

        if (!id) throw error;

        await marcarClienteActivo(id);
        return await obtenerClientePorId(id);
    }
}

async function buscarClientePorDocumento(cedula, idExcluido = null) {
    const comparable = documentoComparable(cedula);
    const result = await db.execute(
        `SELECT * FROM clientes
         WHERE REPLACE(REPLACE(REPLACE(UPPER(cedula), '-', ''), ' ', ''), '.', '') = ?`,
        [comparable]
    );

    return result.rows?.find((row) => String(row.id) !== String(idExcluido ?? '')) ?? null;
}

async function obtenerClientePorId(id) {
    const result = await db.execute('SELECT * FROM clientes WHERE id = ?', [id]);
    return serializarCliente(result.rows?.[0]);
}

async function documentoYaExiste(cedula, idExcluido = null) {
    return Boolean(await buscarClientePorDocumento(cedula, idExcluido));
}

export async function GET({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const search = url.searchParams.get('search') || '';
        const limit = Math.min(
            parseInt(url.searchParams.get('limit')) || (search ? LIMITE_BUSQUEDA : LIMITE_LISTA),
            LIMITE_MAXIMO
        );
        const offset = (page - 1) * limit;

        const esDocumento = /^[A-Za-z0-9-]+$/.test(search.trim()) && /\d/.test(search.trim());

        const query = search
        ? esDocumento
            ? {
                sql: `SELECT * FROM clientes WHERE REPLACE(REPLACE(REPLACE(UPPER(cedula), "-", ""), " ", ""), ".", "") LIKE ? AND ${CLIENTE_ACTIVO} ORDER BY nombre COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
                args: [`%${search.trim().toUpperCase().replace(/[.\s-]/g, '')}%`, limit, offset],
            }
            : {
                sql: `SELECT * FROM clientes WHERE (nombre LIKE ? OR telefono LIKE ? OR cedula LIKE ?) AND ${CLIENTE_ACTIVO} ORDER BY nombre COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
                args: [`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, limit, offset],
            }
        : {
            sql: `SELECT * FROM clientes WHERE ${CLIENTE_ACTIVO} ORDER BY nombre COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
            args: [limit, offset],
            };


        const clientes = await db.execute(query);
        const filas = (clientes.rows || []).map(serializarCliente);

        return new Response(JSON.stringify(filas), {
            headers: jsonHeaders,
        });

    } catch (error) {
        console.error('Error fetching clientes:', error);
        return new Response('Error fetching clientes', { status: 500 });
    }
}

export async function POST({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const validado = validarCliente(body);

        if (!validado.ok) {
            return new Response(JSON.stringify({ error: validado.error }), { status: 400, headers: jsonHeaders });
        }

        const { nombre, telefono, cedula } = validado.cliente;
        const existente = await buscarClientePorDocumento(cedula);

        if (existente) {
            const idExistente = idNumerico(existente.id);
            if ((existente.estatus || 'activo') === 'inactivo' && idExistente) {
                await db.execute({
                    sql: 'UPDATE clientes SET nombre = ?, telefono = ?, cedula = ?, estatus = ? WHERE id = ?',
                    args: [nombre, telefono, cedula, 'activo', idExistente],
                });

                const reactivado = await obtenerClientePorId(idExistente);

                await registrarBitacora(db, {
                    usuario,
                    accion: ACCIONES.CLIENTE_REACTIVAR,
                    entidad: 'clientes',
                    entidadId: idExistente,
                    detalle: `${reactivado?.nombre || nombre} · ${reactivado?.cedula || cedula}`,
                });

                return new Response(JSON.stringify({
                    message: 'Cliente reactivado exitosamente',
                    cliente: reactivado,
                }), { status: 201, headers: jsonHeaders });
            }

            return new Response(JSON.stringify({ error: 'Ya existe un cliente con esa cédula o RIF.' }), {
                status: 409,
                headers: jsonHeaders,
            });
        }

        const clienteAgregado = await insertarClienteActivo(nombre, telefono, cedula);

        if (!clienteAgregado?.id) {
            return new Response(JSON.stringify({ error: 'El cliente se guardó, pero no se pudo leer el registro' }), {
                status: 500,
                headers: jsonHeaders,
            });
        }

        await registrarBitacora(db, {
            usuario,
            accion: ACCIONES.CLIENTE_NUEVO,
            entidad: 'clientes',
            entidadId: clienteAgregado.id,
            detalle: `${clienteAgregado.nombre} · ${clienteAgregado.cedula}`,
        });

        return new Response(JSON.stringify({
            message: 'Cliente agregado exitosamente',
            cliente: clienteAgregado,
        }), { status: 201, headers: jsonHeaders });


    } catch (error) {
        console.error('Error inserting cliente:', error);
        return new Response('Error inserting cliente', { status: 500 });
    }
}

export async function DELETE({ request }) {

    const usuario = verificarToken(request);
    if (!usuario) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return new Response(JSON.stringify({ error: 'Falta el ID del cliente' }), { status: 400 });
        }

        const clienteActivo = await db.execute(
            `SELECT id FROM clientes WHERE id = ? AND ${CLIENTE_ACTIVO}`,
            [id]
        );

        if (!clienteActivo.rows?.length) {
            return new Response(JSON.stringify({ error: 'Cliente no encontrado o ya inactivo' }), { status: 404 });
        }

        const creditosPendientes = await db.execute(
            `SELECT COUNT(*) AS total
             FROM creditos c
             JOIN ventas v ON c.id_venta = v.id
             WHERE v.cliente_id = ?
             AND v.estado != 'anulado'
             AND c.saldo_pendiente > 0`,
            [id]
        );

        if (Number(creditosPendientes.rows[0]?.total ?? 0) > 0) {
            return new Response(JSON.stringify({
                error: 'No se puede inactivar el cliente porque tiene créditos pendientes'
            }), { status: 409 });
        }

        const datos = await obtenerClientePorId(id);
        const result = await db.execute('UPDATE clientes SET estatus = "inactivo" WHERE id = ?', [id]);

        if ((result.rowsAffected ?? result.affectedRows ?? 0) === 0) {
            return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), { status: 404 });
        }

        await registrarBitacora(db, {
            usuario,
            accion: ACCIONES.CLIENTE_ELIMINAR,
            entidad: 'clientes',
            entidadId: id,
            detalle: `${datos?.nombre || 'Cliente'} · ${datos?.cedula || id}`,
        });

        return new Response(JSON.stringify({ message: 'Cliente inactivado exitosamente' }), { status: 200 });


    } catch (error) {
        console.error('Error eliminando cliente:', error);
        return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
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
        const { idCliente } = body;

        if (!idCliente) {
            return new Response(JSON.stringify({ error: 'Faltan datos del cliente' }), { status: 400, headers: jsonHeaders });
        }

        const validado = validarCliente(body);
        if (!validado.ok) {
            return new Response(JSON.stringify({ error: validado.error }), { status: 400, headers: jsonHeaders });
        }

        const { nombre, telefono, cedula } = validado.cliente;

        if (await documentoYaExiste(cedula, idCliente)) {
            return new Response('Ya existe un cliente con esa cédula o RIF.', { status: 409 });
        }

        const result = await db.execute(
            'UPDATE clientes SET nombre = ?, telefono = ?, cedula = ? WHERE id = ?',
            [nombre, telefono, cedula, idCliente]
        );

        if ((result.affectedRows ?? result.rowsAffected ?? 0) === 0) {
            return new Response('Cliente no encontrado', { status: 404 });
        }

        await registrarBitacora(db, {
            usuario,
            accion: ACCIONES.CLIENTE_EDITAR,
            entidad: 'clientes',
            entidadId: idCliente,
            detalle: `${nombre} · ${cedula}`,
        });

        return new Response(JSON.stringify({ message: "Cliente actualizado exitosamente" }), { status: 200 });

    } catch (error) {
        console.error('Error updating cliente:', error);
        return new Response('Error updating cliente', { status: 500 });
    }
}