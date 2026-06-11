export async function cambioUSDaCOP({ strict = false } = {}) {
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

        return tasa;
    } catch (error) {
        console.error('Error fetching tasa:', error);

        if (strict) {
            throw error;
        }

        return 1;
    }
}   
