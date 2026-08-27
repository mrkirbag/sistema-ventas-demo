let tasasCache = null;
let tasasCacheExpira = 0;
const CACHE_MS = 60_000;

function tasasDesdeRespuesta(data) {
    const cop = Number(data?.cop ?? data?.valor);
    const bs = Number(data?.bs);

    if (!Number.isFinite(cop) || cop <= 0) {
        throw new Error('La tasa COP del día no es válida. Actualízala en Tasa del Día.');
    }

    return {
        cop,
        bs: Number.isFinite(bs) && bs > 0 ? bs : 0,
    };
}

export async function obtenerTasas({ strict = false } = {}) {
    if (tasasCache !== null && Date.now() < tasasCacheExpira) {
        return tasasCache;
    }

    try {
        const response = await fetch('/api/tasa');

        if (response.status === 204) {
            throw new Error('No hay tasa registrada. Configura la tasa del día primero.');
        }

        if (!response.ok) {
            throw new Error('Error al obtener la tasa de cambio');
        }

        const data = await response.json();
        const tasas = tasasDesdeRespuesta(data);

        tasasCache = tasas;
        tasasCacheExpira = Date.now() + CACHE_MS;

        return tasas;
    } catch (error) {
        console.error('Error fetching tasa:', error);

        if (strict) {
            throw error;
        }

        return tasasCache ?? { cop: 1, bs: 0 };
    }
}

/** @deprecated Usar obtenerTasas(). Se mantiene para pantallas que aún convierten USD → COP a mano. */
export async function cambioUSDaCOP(opciones = {}) {
    const { cop } = await obtenerTasas(opciones);
    return cop;
}

export function invalidarCacheTasa() {
    tasasCache = null;
    tasasCacheExpira = 0;
}
