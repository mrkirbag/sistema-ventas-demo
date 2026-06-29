let tasaCache = null;
let tasaCacheExpira = 0;
const CACHE_MS = 60_000;

export async function cambioUSDaCOP({ strict = false } = {}) {
    if (tasaCache !== null && Date.now() < tasaCacheExpira) {
        return tasaCache;
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
        const tasa = Number(data.valor);

        if (!Number.isFinite(tasa) || tasa <= 0) {
            throw new Error('La tasa del día no es válida. Actualízala en Tasa del Día.');
        }

        tasaCache = tasa;
        tasaCacheExpira = Date.now() + CACHE_MS;

        return tasa;
    } catch (error) {
        console.error('Error fetching tasa:', error);

        if (strict) {
            throw error;
        }

        return tasaCache ?? 1;
    }
}

export function invalidarCacheTasa() {
    tasaCache = null;
    tasaCacheExpira = 0;
}
