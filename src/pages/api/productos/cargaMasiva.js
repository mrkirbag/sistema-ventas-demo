import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import xlsx from 'xlsx';

export async function POST({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
    }

    const formData = await request.formData();
    const archivo = formData.get('archivo');
    const proveedor = formData.get('proveedor') || 'Desconocido';

    if (!archivo || typeof archivo === 'string') {
        return new Response(JSON.stringify({ error: 'Archivo no recibido' }), { status: 400 });
    }

    const buffer = await archivo.arrayBuffer();
    const workbook = xlsx.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const productos = xlsx.utils.sheet_to_json(sheet);

    const resultados = [];

    // Conteo inicial de productos
    const previos = await db.execute('SELECT COUNT(*) AS total FROM productos WHERE estatus="activo"');
    const productosPrevios = Number(previos.rows[0].total);

    let productosAgregados = 0;
    let montoTotal = 0;

    // Procesar productos
    for (const p of productos) {
        const codigo = String(p.codigo).trim().toUpperCase();
        const nombre = String(p.nombre).trim();
        const stockNuevo = Number(p.stock) || 0;
        const costoNuevo = Number(p.costo) || 0;
        const venta = Number(p.venta) || 0;
        const unidad_medida = String(p.unidad_medida || '').trim();

        if (!codigo || !nombre) continue;

        const existente = await db.execute('SELECT stock, costo FROM productos WHERE codigo = ?', [codigo]);

        if (existente.rows.length > 0) {
            const stockViejo = Number(existente.rows[0].stock) || 0;
            const costoViejo = Number(existente.rows[0].costo) || 0;

            const nuevoStock = stockViejo + stockNuevo;

            // Calcular costo promedio ponderado
            const costoPromedio = nuevoStock > 0
                ? ((stockViejo * costoViejo) + (stockNuevo * costoNuevo)) / nuevoStock
                : costoNuevo;

            await db.execute(
                'UPDATE productos SET stock = ?, costo = ?, venta = ? WHERE codigo = ?',
                [nuevoStock, costoPromedio, venta, codigo]
            );

            montoTotal += costoNuevo * stockNuevo;

            resultados.push({ codigo, nombre, stock: nuevoStock, unidades_nuevas: stockNuevo, costo: costoNuevo, costo_promedio: costoPromedio });
        } else {
            await db.execute(
                'INSERT INTO productos (codigo, nombre, stock, costo, venta, unidad_medida, estatus) VALUES (?, ?, ?, ?, ?, ?, "activo")',
                [codigo, nombre, stockNuevo, costoNuevo, venta, unidad_medida]
            );

            productosAgregados++;
            montoTotal += costoNuevo * stockNuevo;

            resultados.push({ codigo, nombre, stock: stockNuevo, unidades_nuevas: stockNuevo, costo: costoNuevo, costo_promedio: costoNuevo });
        }
    }

    // Registrar la carga masiva
    const carga = await db.execute(
        'INSERT INTO cargas_productos (fecha, proveedor, monto_total, productos_previos, productos_agregados) VALUES (date("now"), ?, ?, ?, ?) RETURNING id',
        [proveedor, montoTotal, productosPrevios, productosAgregados]
    );

    const idCarga = carga.rows[0].id;

    // Insertar detalles con el idCarga real (todos los productos procesados)
    for (const r of resultados) {
        await db.execute(
            'INSERT INTO detalle_carga_productos (id_carga, codigo_producto, nombre_producto, costo, unidades_nuevas) VALUES (?, ?, ?, ?, ?)',
            [idCarga, r.codigo, r.nombre, Number(r.costo) || 0, Number(r.unidades_nuevas) || 0]
        );
    }

    return new Response(JSON.stringify({ resultados, idCarga }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}