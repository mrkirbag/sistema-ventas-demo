import { db } from '../db';
import { verificarToken } from '@/utils/auth';

export async function GET({ request }) {

    const usuario = await verificarToken(request);
    if (!usuario) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const queryMenorStock = `
                                SELECT  
                                    nombre,
                                    stock
                                FROM productos
                                WHERE stock > 0
                                ORDER BY stock ASC
                                LIMIT 5;
                            `;

    try {
        const menorStock = await db.execute(queryMenorStock);

        console.log(menorStock);

        const resultado = menorStock.rows;

        console.log(resultado);
    

        return new Response(JSON.stringify(resultado), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Error en productosStockCritico:', err);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
