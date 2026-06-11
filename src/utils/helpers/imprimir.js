import empresa from '@/data/empresa.json';

const ESTILOS_BASE = `
    body {
        font-family: Arial, sans-serif;
        margin: 20px;
        font-size: 12px;
        color: #111;
    }

    h1, h2, h3 {
        margin: 0;
        padding: 2px 0;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
        margin-bottom: 1rem;
    }

    th, td {
        border: 1px solid #000;
        padding: 6px 8px;
        text-align: left;
        font-size: 11px;
    }

    thead {
        background: #eee;
    }

    p {
        margin: 4px 0;
    }

    img {
        max-width: 100%;
        height: auto;
    }

    .contenido-impresion {
        margin-top: 1rem;
    }
`;

const ESTILOS_ENCABEZADO = `
    .encabezado-impresion {
        text-align: center;
        border-bottom: 2px solid #1f0a52;
        padding-bottom: 12px;
        margin-bottom: 16px;
    }

    .encabezado-impresion img {
        max-width: 90px;
        height: auto;
        margin-bottom: 8px;
    }

    .encabezado-impresion h1 {
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .encabezado-impresion .subtitulo {
        font-size: 11px;
        color: #444;
    }

    .encabezado-impresion .contacto,
    .encabezado-impresion .direccion {
        font-size: 11px;
        color: #333;
    }

    .encabezado-impresion .titulo-documento {
        margin-top: 10px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #1f0a52;
    }

    .encabezado-impresion .fecha-impresion {
        font-size: 10px;
        color: #666;
        margin-top: 6px;
    }
`;

export function generarEncabezadoImpresion(tituloDocumento = '') {
    const fecha = new Date().toLocaleDateString('es-VE', {
        timeZone: 'America/Caracas',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    return `
        <div class="encabezado-impresion">
            <img src="${empresa.logo}" alt="Logo de ${empresa.nombre}" />
            <h1>${empresa.nombre}</h1>
            <p class="subtitulo">${empresa.subtitulo}</p>
            <p class="contacto">RIF: ${empresa.rif} | Tel: ${empresa.telefono}</p>
            ${empresa.direccion ? `<p class="direccion">${empresa.direccion}</p>` : ''}
            ${tituloDocumento ? `<h2 class="titulo-documento">${tituloDocumento}</h2>` : ''}
            <p class="fecha-impresion">Fecha de impresión: ${fecha}</p>
        </div>
    `;
}

/**
 * Abre una ventana de impresión con encabezado de empresa y contenido personalizado.
 * @param {Object} options
 * @param {string} [options.titulo]
 * @param {string} [options.tituloDocumento]
 * @param {string} [options.contenido]
 * @param {string} [options.estilosExtra]
 * @param {string|null} [options.pageSize]
 * @param {boolean} [options.mostrarEncabezado]
 * @param {(ventana: Window) => void} [options.onReady]
 */
export function imprimir({
    titulo = 'Impresión',
    tituloDocumento = '',
    contenido = '',
    estilosExtra = '',
    pageSize = null,
    mostrarEncabezado = true,
    onReady = null,
}) {
    const ventana = window.open('', '', 'width=800,height=600');
    if (!ventana) return;

    const pageRule = pageSize ? `@page { size: ${pageSize}; margin: 0.5in; }` : '';
    const encabezado = mostrarEncabezado
        ? generarEncabezadoImpresion(tituloDocumento)
        : (tituloDocumento ? `<h2 class="titulo-documento">${tituloDocumento}</h2>` : '');

    ventana.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>${titulo}</title>
                <style>
                    ${ESTILOS_BASE}
                    ${ESTILOS_ENCABEZADO}
                    @media print {
                        ${pageRule}
                        body { font-size: 11pt; }
                    }
                    ${estilosExtra}
                </style>
            </head>
            <body>
                ${encabezado}
                <div class="contenido-impresion">
                    ${contenido}
                </div>
            </body>
        </html>
    `);

    ventana.document.close();

    if (typeof onReady === 'function') {
        onReady(ventana);
        return;
    }

    ventana.focus();
    ventana.print();
    ventana.close();
}
