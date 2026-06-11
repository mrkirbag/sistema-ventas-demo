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

function renderModal({ mensaje, titulo, variante, acciones = [] }) {
    const { overlay, modal } = ensureModalElements();

    resetModal(modal, overlay);

    const icon = variante === 'success' ? 'OK' : variante === 'error' ? '!' : '?';

    modal.setAttribute('data-variant', variante);
    modal.innerHTML = `
        <div class="modal-icon">${icon}</div>
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

function mostrarModal(mensaje, variante) {
    const titulos = {
        success: 'Operacion exitosa',
        error: 'Atencion',
    };

    const { overlay, modal } = renderModal({
        mensaje,
        titulo: titulos[variante],
        variante,
    });

    activeTimer = window.setTimeout(() => {
        resetModal(modal, overlay);
    }, 1600);
}

export function mostrarMensaje(mensaje) {
    mostrarModal(mensaje, 'success');
}

export function mostrarError(mensaje) {
    mostrarModal(mensaje, 'error');
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
