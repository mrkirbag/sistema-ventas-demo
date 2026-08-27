import empresa from '@/data/empresa.json';

export const MONEDAS = Object.freeze({
    USD: 'USD',
    COP: 'COP',
    BS: 'BS',
});

const ETIQUETAS = {
    USD: 'USD',
    COP: 'COP',
    BS: 'Bs',
};

/**
 * Moneda en la que el comercio carga sus precios.
 * USD: referencia COP = precio USD × tasa COP; Bs = precio USD × tasa Bs
 * COP: referencia USD = precio COP ÷ tasa COP; Bs = (precio COP ÷ tasa COP) × tasa Bs
 */
export function obtenerMonedaBase() {
    return empresa?.monedaBase === MONEDAS.COP ? MONEDAS.COP : MONEDAS.USD;
}

export function etiquetaMoneda(moneda) {
    return ETIQUETAS[String(moneda || '').toUpperCase()] || String(moneda || '');
}

/** Dólares: cifra cerrada o a ,5 (10 → 10, 10.2 → 10, 10.3 → 10.5). */
export function redondearUSD(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 2) / 2;
}

/** Pesos: siempre hacia la cifra de 100 inmediata superior (19220 → 19300). */
export function redondearCOP(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.ceil(n / 100) * 100;
}

/** Bolívares: 2 decimales. */
export function redondearBS(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100) / 100;
}

export function redondearMoneda(valor, moneda) {
    switch (String(moneda || '').toUpperCase()) {
        case MONEDAS.COP:
            return redondearCOP(valor);
        case MONEDAS.BS:
            return redondearBS(valor);
        case MONEDAS.USD:
        default:
            return redondearUSD(valor);
    }
}

function aUsd(monto, moneda, tasas) {
    const n = Number(monto);
    const origen = String(moneda || '').toUpperCase();
    const { cop, bs } = tasasValidas(tasas);

    if (!Number.isFinite(n) || n <= 0) return 0;
    if (origen === MONEDAS.USD) return n;
    if (origen === MONEDAS.COP) return cop > 0 ? n / cop : 0;
    if (origen === MONEDAS.BS) return bs > 0 ? n / bs : 0;
    return 0;
}

/** Convierte un monto pagado en USD, COP o Bs a la moneda base del comercio. */
export function convertirAMonedaBase(monto, monedaOrigen, monedaBase, tasas) {
    const n = Number(monto);
    const origen = String(monedaOrigen || '').toUpperCase();
    const base = String(monedaBase || obtenerMonedaBase()).toUpperCase();
    const { cop, bs } = tasasValidas(tasas);

    if (!Number.isFinite(n) || n <= 0) return 0;
    if (origen === base) return n;

    const usd = aUsd(n, origen, { cop, bs });
    if (base === MONEDAS.USD) return usd;
    if (base === MONEDAS.COP) return cop > 0 ? usd * cop : 0;
    return bs > 0 ? usd * bs : 0;
}

export function toleranciaPago(monedaBase) {
    const base = String(monedaBase || obtenerMonedaBase()).toUpperCase();
    if (base === MONEDAS.COP) return 100;
    if (base === MONEDAS.BS) return 0.05;
    return 0.51;
}

function tasasValidas(tasas) {
    return {
        cop: Number(tasas?.cop) > 0 ? Number(tasas.cop) : 0,
        bs: Number(tasas?.bs) > 0 ? Number(tasas.bs) : 0,
    };
}

/**
 * Convierte un precio en la moneda base del comercio a USD, COP y Bs.
 * Cada moneda se redondea con su propia regla. La moneda base se conserva
 * como fuente (no se recalcula a partir de otra ya redondeada).
 */
export function convertirPrecio(precio, monedaBase, tasas) {
    const n = Number(precio);
    const { cop: tasaCop, bs: tasaBs } = tasasValidas(tasas);
    const base = String(monedaBase || obtenerMonedaBase()).toUpperCase();

    if (!Number.isFinite(n) || n <= 0) {
        return { usd: 0, cop: 0, bs: 0 };
    }

    if (base === MONEDAS.COP) {
        const cop = redondearCOP(n);
        const usdPivot = tasaCop > 0 ? cop / tasaCop : 0;
        return {
            usd: redondearUSD(usdPivot),
            cop,
            bs: tasaBs > 0 ? redondearBS(usdPivot * tasaBs) : 0,
        };
    }

    const usd = redondearUSD(n);
    return {
        usd,
        cop: tasaCop > 0 ? redondearCOP(usd * tasaCop) : 0,
        bs: tasaBs > 0 ? redondearBS(usd * tasaBs) : 0,
    };
}

export function formatearMoneda(valor, moneda) {
    const codigo = String(moneda || '').toUpperCase();
    const n = Number(valor) || 0;
    const etiqueta = etiquetaMoneda(codigo);

    if (codigo === MONEDAS.COP) {
        return `${Math.round(n).toLocaleString('es-CO')} ${etiqueta}`;
    }

    if (codigo === MONEDAS.BS) {
        return `${n.toFixed(2)} ${etiqueta}`;
    }

    const decimales = n % 1 === 0 ? 0 : 1;
    return `${n.toFixed(decimales)} ${etiqueta}`;
}

function monedasVisibles(montos, tasas) {
    const { cop, bs } = tasasValidas(tasas);
    return [
        montos.usd > 0 ? MONEDAS.USD : null,
        cop > 0 && montos.cop > 0 ? MONEDAS.COP : null,
        bs > 0 && montos.bs > 0 ? MONEDAS.BS : null,
    ].filter(Boolean);
}

export function textoReferencia(precio, monedaBase, tasas) {
    const n = Number(String(precio).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
        return 'Referencia: —';
    }

    const base = String(monedaBase || obtenerMonedaBase()).toUpperCase();
    const montos = convertirPrecio(n, base, tasas);
    const otras = monedasVisibles(montos, tasas).filter((moneda) => moneda !== base);

    if (otras.length === 0) {
        return 'Referencia: —';
    }

    const partes = otras.map((moneda) => formatearMoneda(montos[moneda.toLowerCase()], moneda));
    return `Referencia: ${partes.join(' · ')}`;
}

export function textoTotal(precio, monedaBase, tasas) {
    const n = Number(precio);
    if (!Number.isFinite(n) || n <= 0) {
        return '—';
    }

    const base = String(monedaBase || obtenerMonedaBase()).toUpperCase();
    const montos = convertirPrecio(n, base, tasas);
    return monedasVisibles(montos, tasas)
        .map((moneda) => formatearMoneda(montos[moneda.toLowerCase()], moneda))
        .join(' · ');
}

export function desgloseMontos(precio, monedaBase, tasas) {
    const base = String(monedaBase || obtenerMonedaBase()).toUpperCase();
    const montos = convertirPrecio(precio, base, tasas);
    const visibles = monedasVisibles(montos, tasas);
    const principal = visibles.includes(base) ? base : (visibles[0] || base);
    const secundarias = visibles.filter((moneda) => moneda !== principal);

    return {
        montos,
        principal: formatearMoneda(montos[principal.toLowerCase()], principal),
        secundarias: secundarias
            .map((moneda) => formatearMoneda(montos[moneda.toLowerCase()], moneda))
            .join(' · '),
    };
}
