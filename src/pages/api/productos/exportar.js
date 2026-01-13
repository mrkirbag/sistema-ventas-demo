import { db } from '../db';
import { verificarToken } from '@/utils/auth';
import xlsx from 'xlsx';

export async function GET({ request }) {
    
    // Verificar token
    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if (usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
    }

    try {

        const result = await db.execute("SELECT codigo, nombre, stock, unidad_medida, costo, venta FROM productos WHERE estatus = 'activo'");
        const productos = result.rows;

        const worksheet = xlsx.utils.json_to_sheet(productos);

        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Productos');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="productos.xlsx"',
            },
        });
    } catch (error) {
        console.error('Error al exportar productos:', error);
        return new Response(JSON.stringify({ error: 'Error al exportar productos' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}