import {
    MONEDAS,
    convertirAMonedaBase,
    convertirPrecio,
    etiquetaMoneda,
    formatearMoneda,
    obtenerMonedaBase,
    toleranciaPago,
} from '@/utils/helpers/tasas.js';

/**
 * @typedef {{ id: string, etiqueta: string }} OpcionPago
 * @typedef {{ moneda: string, metodo: string, monto: number, monto_base: number, moneda_base: string, tasa_cop: number, tasa_bs: number, etiqueta: string }} PagoNormalizado
 * @typedef {{ ok: true, pago: PagoNormalizado } | { ok: false, error: string }} ResultadoLineaPago
 * @typedef {{ ok: true, pagos: PagoNormalizado[], cubierto: number, restante: number } | { ok: false, error: string }} ResultadoPagosVenta
 */

export const METODOS_POR_MONEDA = Object.freeze({
    USD: Object.freeze([
        { id: 'efectivo', etiqueta: 'Efectivo' },
        { id: 'zelle', etiqueta: 'Zelle' },
        { id: 'binance', etiqueta: 'Binance' },
        { id: 'nota_credito', etiqueta: 'Nota de crédito' },
    ]),
    COP: Object.freeze([
        { id: 'efectivo', etiqueta: 'Efectivo' },
        { id: 'bancolombia', etiqueta: 'Bancolombia' },
        { id: 'nequi', etiqueta: 'Nequi' },
    ]),
    BS: Object.freeze([
        { id: 'transferencia', etiqueta: 'Transferencia' },
        { id: 'pago_movil', etiqueta: 'Pago móvil' },
        { id: 'punto_venta', etiqueta: 'Punto de venta' },
    ]),
});

/** @returns {OpcionPago[]} */
export function metodosDeMoneda(moneda) {
    return METODOS_POR_MONEDA[String(moneda || '').toUpperCase()] || [];
}

export function etiquetaMetodo(moneda, metodo) {
    const hallado = metodosDeMoneda(moneda).find((item) => item.id === metodo);
    return hallado?.etiqueta || String(metodo || '');
}

export function etiquetaPago(moneda, metodo) {
    return `${etiquetaMetodo(moneda, metodo)} · ${etiquetaMoneda(moneda)}`;
}

/** @returns {OpcionPago[]} */
export function monedasPagoDisponibles(tasas) {
    const cop = Number(tasas?.cop) > 0;
    const bs = Number(tasas?.bs) > 0;
    /** @type {OpcionPago[]} */
    const monedas = [{ id: MONEDAS.USD, etiqueta: 'USD' }];
    if (cop) monedas.push({ id: MONEDAS.COP, etiqueta: 'COP' });
    if (bs) monedas.push({ id: MONEDAS.BS, etiqueta: 'Bs' });
    return monedas;
}

function metodoValido(moneda, metodo) {
    return metodosDeMoneda(moneda).some((item) => item.id === metodo);
}

/**
 * @returns {ResultadoLineaPago}
 */
export function parsearLineaPago(pago, monedaBase, tasas) {
    const base = monedaBase || obtenerMonedaBase();
    const moneda = String(pago?.moneda || '').toUpperCase();
    const metodo = String(pago?.metodo || '').trim();

    if (!METODOS_POR_MONEDA[moneda]) {
        return { ok: false, error: 'Selecciona una moneda válida para el pago (USD, COP o Bs)' };
    }

    if (!metodoValido(moneda, metodo)) {
        return { ok: false, error: `El método de pago no es válido para ${etiquetaMoneda(moneda)}` };
    }

    if (moneda === MONEDAS.COP && !(Number(tasas?.cop) > 0)) {
        return { ok: false, error: 'No hay tasa COP del día para registrar un pago en pesos' };
    }

    if (moneda === MONEDAS.BS && !(Number(tasas?.bs) > 0)) {
        return { ok: false, error: 'No hay tasa Bs del día para registrar un pago en bolívares' };
    }

    const montoOk = parsearMontoPago(pago?.monto, moneda);
    if (!montoOk.ok) return { ok: false, error: montoOk.error };

    const montoBase = convertirAMonedaBase(montoOk.valor, moneda, base, tasas);
    if (!(montoBase > 0)) {
        return { ok: false, error: `No se pudo convertir el pago en ${etiquetaMoneda(moneda)} a ${etiquetaMoneda(base)}` };
    }

    return {
        ok: true,
        pago: {
            moneda,
            metodo,
            monto: montoOk.valor,
            monto_base: Math.round(montoBase * 10000) / 10000,
            moneda_base: base,
            tasa_cop: Number(tasas?.cop) || 0,
            tasa_bs: Number(tasas?.bs) || 0,
            etiqueta: etiquetaPago(moneda, metodo),
        },
    };
}

/** @returns {{ ok: true, valor: number } | { ok: false, error: string }} */
function parsearMontoPago(valor, moneda) {
    const n = Number(String(valor ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, error: 'El monto de cada pago debe ser mayor a cero' };
    }

    const codigo = String(moneda || '').toUpperCase();
    const monto = codigo === MONEDAS.COP
        ? Math.round(n)
        : Math.round(n * 100) / 100;

    if (!(monto > 0)) {
        return { ok: false, error: 'El monto de cada pago debe ser mayor a cero' };
    }

    return { ok: true, valor: monto };
}

/**
 * @param {{ tipoPago: string, pagos?: unknown, totalBase: number, monedaBase?: string, tasas: { cop: number, bs: number } }} [args]
 * @returns {ResultadoPagosVenta}
 */
export function validarPagosVenta({ tipoPago, pagos, totalBase, monedaBase, tasas } = {}) {
    const base = monedaBase || obtenerMonedaBase();
    const total = Number(totalBase);

    if (tipoPago === 'credito') {
        return { ok: true, pagos: [], cubierto: 0, restante: total };
    }

    if (tipoPago !== 'contado') {
        return { ok: false, error: 'Tipo de pago inválido' };
    }

    if (!Array.isArray(pagos) || pagos.length === 0) {
        return { ok: false, error: 'Agrega al menos un método de pago para la venta de contado' };
    }

    const normalizados = [];

    for (const pago of pagos) {
        const linea = parsearLineaPago(pago, base, tasas);
        if (!linea.ok) return linea;
        normalizados.push(linea.pago);
    }

    const cubierto = normalizados.reduce((acc, pago) => acc + pago.monto_base, 0);
    const restante = total - cubierto;
    const tolerancia = toleranciaPago(base);

    if (restante > tolerancia) {
        return {
            ok: false,
            error: `Falta por cubrir ${formatearMoneda(restante, base)} con los métodos de pago`,
        };
    }

    if (restante < -tolerancia) {
        return {
            ok: false,
            error: `Los pagos exceden el total por ${formatearMoneda(Math.abs(restante), base)}`,
        };
    }

    return { ok: true, pagos: normalizados, cubierto, restante };
}

export function resumenPagos(pagos, totalBase, monedaBase, tasas) {
    const base = monedaBase || obtenerMonedaBase();
    const cubierto = (pagos || []).reduce((acc, pago) => acc + Number(pago.monto_base || 0), 0);
    const restante = Math.max(0, Number(totalBase) - cubierto);
    const equivalentes = convertirPrecio(restante, base, tasas);

    return {
        cubierto,
        restante,
        completo: restante <= toleranciaPago(base),
        equivalentes,
        cubiertoTexto: formatearMoneda(cubierto, base),
        restanteTexto: formatearMoneda(restante, base),
        totalTexto: formatearMoneda(totalBase, base),
    };
}

export function montoRestanteEnMoneda(restanteBase, monedaDestino, monedaBase, tasas) {
    const montos = convertirPrecio(restanteBase, monedaBase || obtenerMonedaBase(), tasas);
    const clave = String(monedaDestino || '').toLowerCase();
    return Number(montos[clave]) || 0;
}
