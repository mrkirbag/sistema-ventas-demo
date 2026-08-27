const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONOS = {
    agregar: {
        label: 'Agregar stock',
        svg: `<svg ${SVG_ATTRS}><path d="M12 5v14M5 12h14"/></svg>`,
    },
    sacar: {
        label: 'Sacar stock',
        svg: `<svg ${SVG_ATTRS}><path d="M5 12h14"/></svg>`,
    },
    historial: {
        label: 'Historial',
        svg: `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
    },
    editar: {
        label: 'Editar',
        svg: `<svg ${SVG_ATTRS}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    },
    eliminar: {
        label: 'Eliminar',
        svg: `<svg ${SVG_ATTRS}><path d="M3 6h18"/><path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`,
    },
};

export function ponerIcono(elemento, tipo) {
    const icono = ICONOS[tipo];
    if (!elemento || !icono) return elemento;

    elemento.innerHTML = icono.svg;
    elemento.classList.add('btn-icono');
    elemento.setAttribute('aria-label', icono.label);
    if (!elemento.title) {
        elemento.title = icono.label;
    }

    return elemento;
}
