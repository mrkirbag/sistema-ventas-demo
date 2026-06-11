let activeTimer = null;
let cleanupCurrentModal = null;

export function noRegistros(mensaje) {
    const errorCampo = document.getElementById('mensaje');

    if (!errorCampo) {
        if (mensaje) {
            mostrarError(mensaje);
        }
        return;
    }

    if (mensaje === '') {
        errorCampo.style.display = 'none';
        errorCampo.textContent = '';
        errorCampo.classList.remove('mensaje-sin-registros');
        return;
    }

    errorCampo.style.display = 'flex';
    errorCampo.textContent = mensaje;
    errorCampo.classList.add('mensaje-sin-registros');
}

function ensureModalElements() {
    let overlay = document.getElementById('overlay');
    let modal = document.getElementById('modal');

    if (!overlay || !modal) {
        overlay = document.createElement('div');
        overlay.id = 'overlay';
        overlay.className = 'overlay oculto';

        modal = document.createElement('div');
        modal.id = 'modal';
        modal.className = 'modal';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    return { overlay, modal };
}

function resetModal(modal, overlay) {
    if (activeTimer) {
        window.clearTimeout(activeTimer);
        activeTimer = null;
    }

    if (cleanupCurrentModal) {
        cleanupCurrentModal();
        cleanupCurrentModal = null;
    }

    modal.innerHTML = '';
    modal.removeAttribute('data-variant');
    overlay.classList.remove('visible');
    overlay.classList.add('oculto');
}

const MODAL_ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>`,
    confirm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>`,
};

function renderModal({ mensaje, titulo, variante, acciones = [] }) {
    const { overlay, modal } = ensureModalElements();

    resetModal(modal, overlay);

    modal.setAttribute('data-variant', variante);
    modal.innerHTML = `
        <div class="modal-icon">${MODAL_ICONS[variante] ?? MODAL_ICONS.confirm}</div>
        <h3 class="modal-title">${titulo}</h3>
        <p class="modal-message">${mensaje}</p>
        <div class="modal-actions"></div>
    `;

    const actionsContainer = modal.querySelector('.modal-actions');

    acciones.forEach((accion) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `modal-action ${accion.primary ? 'modal-action--primary' : 'modal-action--secondary'}`;
        button.textContent = accion.label;
        button.addEventListener('click', accion.onClick);
        actionsContainer.appendChild(button);
    });

    overlay.classList.remove('oculto');
    overlay.classList.add('visible');

    return { overlay, modal };
}

function mostrarModal(mensaje, variante, opciones = {}) {
    const titulos = {
        success: 'Operación exitosa',
        error: 'Atención',
    };

    const { overlay, modal } = renderModal({
        mensaje,
        titulo: opciones.titulo ?? titulos[variante],
        variante,
    });

    const duracion = opciones.duracion ?? 1600;

    activeTimer = window.setTimeout(() => {
        resetModal(modal, overlay);
    }, duracion);
}

export function mostrarMensaje(mensaje, opciones = {}) {
    mostrarModal(mensaje, 'success', opciones);
}

export function mostrarError(mensaje, opciones = {}) {
    mostrarModal(mensaje, 'error', opciones);
}

export function confirmarAccion(mensaje, opciones = {}) {
    const {
        titulo = 'Confirmar accion',
        textoAceptar = 'Confirmar',
        textoCancelar = 'Cancelar',
    } = opciones;

    return new Promise((resolve) => {
        const close = (resultado) => {
            const { overlay, modal } = ensureModalElements();
            resetModal(modal, overlay);
            resolve(resultado);
        };

        const { overlay } = renderModal({
            mensaje,
            titulo,
            variante: 'confirm',
            acciones: [
                {
                    label: textoCancelar,
                    primary: false,
                    onClick: () => close(false),
                },
                {
                    label: textoAceptar,
                    primary: true,
                    onClick: () => close(true),
                },
            ],
        });

        const onOverlayClick = (event) => {
            if (event.target === overlay) {
                close(false);
            }
        };

        const onEscape = (event) => {
            if (event.key === 'Escape') {
                close(false);
            }
        };

        cleanupCurrentModal = () => {
            overlay.removeEventListener('click', onOverlayClick);
            document.removeEventListener('keydown', onEscape);
        };

        overlay.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onEscape);
    });
}
