import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    if(usuario.rol !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 });
    }


    const queryMenorStock = `
                                SELECT 
                                    codigo AS codigo_producto,
                                    nombre AS nombre_producto,
                                    stock AS cantidad_total,
                                    unidad_medida
                                FROM productos
                                WHERE stock > 0
                                ORDER BY stock ASC
                                LIMIT 10;
                            `;

    const queryAgotados = `
                            SELECT 
                                codigo AS codigo_producto,
                                nombre AS nombre_producto,
                                stock AS cantidad_total,
                                unidad_medida
                            FROM productos
                            WHERE stock = 0
                            ORDER BY nombre ASC;
                        `;

    try {
        const [menorStock, agotados] = await Promise.all([
            db.execute(queryMenorStock),
            db.execute(queryAgotados)
        ]);

        const resultado = {
            bajos: menorStock.rows,
            agotados: agotados.rows
        };

        return new Response(JSON.stringify(resultado), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Error en productosStockCritico:', err);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
