/** Paleta de marca. Cambia solo estos tres valores para un cliente nuevo. */
export const COLORES = {
    primario: '#0f0529',
    secundario: '#1f0a52',
    acento: '#4d2ea3',
} as const;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
    const clean = String(hex || '').replace('#', '').trim();
    const full = clean.length === 3
        ? clean.split('').map((char) => char + char).join('')
        : clean;
    const value = Number.parseInt(full, 16);

    if (!Number.isFinite(value)) {
        return { r: 15, g: 5, b: 41 };
    }

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
}

function rgbString(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    return `${r}, ${g}, ${b}`;
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
    return {
        r: Math.round(from.r + (to.r - from.r) * amount),
        g: Math.round(from.g + (to.g - from.g) * amount),
        b: Math.round(from.b + (to.b - from.b) * amount),
    };
}

function rgbaFrom(rgb: Rgb, alpha: number) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function getColores() {
    return { ...COLORES };
}

export function estiloTemaInline() {
    const { primario, secundario, acento } = COLORES;

    return [
        `--primary-color: ${primario}`,
        `--primary-rgb: ${rgbString(primario)}`,
        `--secondary-color: ${secundario}`,
        `--secondary-rgb: ${rgbString(secundario)}`,
        `--accent-brand: ${acento}`,
        `--accent-rgb: ${rgbString(acento)}`,
    ].join('; ');
}

export function colorRgba(hex: string, alpha: number) {
    return `rgba(${rgbString(hex)}, ${alpha})`;
}

export function paletaGraficos() {
    const { primario, secundario, acento } = COLORES;
    const primary = hexToRgb(primario);
    const secondary = hexToRgb(secundario);
    const accent = hexToRgb(acento);
    const white = { r: 255, g: 255, b: 255 };

    return [
        rgbaFrom(secondary, 0.92),
        rgbaFrom(accent, 0.88),
        rgbaFrom(mixRgb(accent, white, 0.22), 0.88),
        rgbaFrom(mixRgb(accent, white, 0.42), 0.88),
        rgbaFrom(mixRgb(primary, accent, 0.55), 0.88),
        rgbaFrom(mixRgb(secondary, accent, 0.35), 0.88),
        rgbaFrom(mixRgb(primary, secondary, 0.45), 0.88),
        rgbaFrom(mixRgb(accent, white, 0.58), 0.88),
    ];
}
