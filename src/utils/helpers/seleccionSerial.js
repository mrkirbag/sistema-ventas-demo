function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const pickers = new WeakMap();
const pickersActivos = new Set();
let cierreGlobalListo = false;

function filtrarSeriales(seriales, termino) {
    const normalizado = String(termino ?? '').trim().toLowerCase();
    if (!normalizado) return seriales;
    return seriales.filter(s => s.toLowerCase().includes(normalizado));
}

function htmlTrigger(serial) {
    if (!serial) {
        return '<span class="producto-picker_placeholder">Seleccionar serial</span>';
    }
    return `
        <span class="producto-picker_trigger-copy">
            <span class="producto-picker_trigger-name">${escapeHtml(serial)}</span>
        </span>
    `;
}

function htmlItem(serial, seleccionado) {
    return `
        <button
            type="button"
            class="producto-picker_item ${seleccionado ? 'is-selected' : ''}"
            role="option"
            data-serial="${escapeHtml(serial)}"
            aria-selected="${seleccionado ? 'true' : 'false'}"
            style="grid-template-columns: 1fr;"
        >
            <span class="producto-picker_nombre" style="font-family: monospace;">${escapeHtml(serial)}</span>
        </button>
    `;
}

function posicionarPanel(picker) {
    const rect = picker.trigger.getBoundingClientRect();
    const margen = 12;
    const espacioAbajo = window.innerHeight - rect.bottom - margen;
    const espacioArriba = rect.top - margen;
    const abrirArriba = espacioAbajo < 220 && espacioArriba > espacioAbajo;
    const disponible = Math.max(abrirArriba ? espacioArriba : espacioAbajo, 160);
    const maxPanel = Math.min(280, disponible);

    picker.panel.style.position = 'fixed';
    picker.panel.style.left = `${Math.max(margen, rect.left)}px`;
    picker.panel.style.width = `${rect.width}px`;
    picker.panel.style.right = 'auto';
    picker.panel.style.zIndex = '80';
    picker.panel.style.maxHeight = `${maxPanel}px`;

    if (abrirArriba) {
        picker.panel.style.top = 'auto';
        picker.panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
        picker.panel.style.top = `${rect.bottom + 6}px`;
        picker.panel.style.bottom = 'auto';
    }

    const cabeza = picker.panel.querySelector('.producto-picker_head');
    const altoCabeza = cabeza && getComputedStyle(cabeza).display !== 'none'
        ? cabeza.getBoundingClientRect().height
        : 0;
    picker.list.style.maxHeight = `${Math.max(120, maxPanel - altoCabeza)}px`;
}

function quitarSeguimientoPanel(picker) {
    if (!picker.alRepositionar) return;
    window.removeEventListener('resize', picker.alRepositionar);
    window.removeEventListener('scroll', picker.alRepositionar, true);
    picker.alRepositionar = null;
}

function setAbierto(picker, abierto) {
    picker.wrap.classList.toggle('is-open', abierto);
    picker.trigger.setAttribute('aria-expanded', String(abierto));
    picker.panel.hidden = !abierto;

    if (abierto) {
        quitarSeguimientoPanel(picker);
        document.body.appendChild(picker.panel);
        posicionarPanel(picker);
        picker.list.scrollTop = 0;

        picker.alRepositionar = () => posicionarPanel(picker);
        window.addEventListener('resize', picker.alRepositionar);
        window.addEventListener('scroll', picker.alRepositionar, true);
        return;
    }

    quitarSeguimientoPanel(picker);
    picker.wrap.appendChild(picker.panel);
    picker.panel.style.maxHeight = '';
    picker.list.style.maxHeight = '';
}

function asegurarCierreGlobal() {
    if (cierreGlobalListo) return;
    cierreGlobalListo = true;

    document.addEventListener('click', (event) => {
        pickersActivos.forEach((select) => {
            const picker = pickers.get(select);
            if (!picker || picker.panel.hidden) return;
            if (picker.wrap.contains(event.target)) return;
            if (picker.panel.contains(event.target)) return;
            if (event.target.closest('#busquedaSeriales')) return;
            setAbierto(picker, false);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        pickersActivos.forEach((select) => {
            const picker = pickers.get(select);
            if (!picker || picker.panel.hidden) return;
            setAbierto(picker, false);
            picker.trigger.focus();
        });
    });
}

function actualizarTrigger(picker) {
    const seleccionado = picker.select.value;
    picker.trigger.innerHTML = htmlTrigger(seleccionado);
    picker.trigger.classList.toggle('has-value', Boolean(seleccionado));
}

function montarPicker(serialSelect) {
    const existente = pickers.get(serialSelect);
    if (existente) return existente;

    const wrap = document.createElement('div');
    wrap.className = 'producto-picker';
    serialSelect.parentNode.insertBefore(wrap, serialSelect);
    wrap.appendChild(serialSelect);
    serialSelect.classList.add('producto-picker_native');
    serialSelect.setAttribute('tabindex', '-1');
    serialSelect.setAttribute('aria-hidden', 'true');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'producto-picker_trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Seleccionar serial');

    const panel = document.createElement('div');
    panel.className = 'producto-picker_panel';
    panel.hidden = true;

    panel.innerHTML = `
        <div class="producto-picker_head" aria-hidden="true" style="grid-template-columns: 1fr;">
            <span>Serial Disponible</span>
        </div>
        <div class="producto-picker_list" role="listbox"></div>
    `;

    const list = panel.querySelector('.producto-picker_list');
    wrap.appendChild(trigger);
    wrap.appendChild(panel);

    const picker = { select: serialSelect, wrap, trigger, panel, list, serialesCache: [] };
    pickers.set(serialSelect, picker);
    pickersActivos.add(serialSelect);
    asegurarCierreGlobal();

    trigger.addEventListener('click', () => {
        const abrir = picker.panel.hidden;
        setAbierto(picker, abrir);
        if (abrir) {
            renderLista(picker);
            posicionarPanel(picker);
        }
    });

    list.addEventListener('click', (event) => {
        const item = event.target.closest('[data-serial]');
        if (!item) return;
        seleccionarSerial(picker, item.dataset.serial);
    });

    actualizarTrigger(picker);
    return picker;
}

function seleccionarSerial(picker, serial) {
    picker.select.value = serial;
    picker.select.dispatchEvent(new Event('change', { bubbles: true }));
    actualizarTrigger(picker);
    setAbierto(picker, false);
}

function renderLista(picker, seriales = null) {
    const lista = seriales ?? filtrarSeriales(picker.serialesCache, '');
    const seleccionadoSerial = String(picker.select.value || '');

    if (!lista.length) {
        picker.list.innerHTML = `
            <p class="producto-picker_empty">
                ${picker.serialesCache.length ? 'No hay coincidencias' : 'No hay seriales disponibles'}
            </p>
        `;
        return;
    }

    picker.list.innerHTML = lista.map((serial) => (
        htmlItem(serial, serial === seleccionadoSerial)
    )).join('');

    if (!picker.panel.hidden) {
        posicionarPanel(picker);
    }
}

export function cargarSerialesEnSelect(serialSelect, seriales) {
    const picker = montarPicker(serialSelect);
    picker.serialesCache = seriales;
    const valorActual = serialSelect.value;
    serialSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.textContent = seriales.length ? 'Selecciona un serial' : 'No hay seriales disponibles';
    serialSelect.appendChild(defaultOption);

    const fragment = document.createDocumentFragment();
    seriales.forEach((serial) => {
        const option = document.createElement('option');
        option.value = serial;
        option.textContent = serial;
        fragment.appendChild(option);
    });
    serialSelect.appendChild(fragment);

    const sigueDisponible = seriales.some((s) => s === valorActual);
    serialSelect.value = sigueDisponible ? valorActual : '';
    if (!serialSelect.value) {
        defaultOption.selected = true;
    }

    renderLista(picker, seriales);
    actualizarTrigger(picker);
}

function renderSerialesFiltrados(serialSelect, termino = '') {
    const picker = pickers.get(serialSelect);
    if (!picker) return;
    const filtrados = filtrarSeriales(picker.serialesCache, termino);
    renderLista(picker, filtrados);
}

export function crearModuloSeriales({
    serialSelect,
    busquedaInput,
}) {
    const picker = montarPicker(serialSelect);
    cargarSerialesEnSelect(serialSelect, []);

    if (busquedaInput instanceof HTMLInputElement) {
        busquedaInput.addEventListener('input', () => {
            renderSerialesFiltrados(serialSelect, busquedaInput.value);
            if (busquedaInput.value.trim()) {
                setAbierto(picker, true);
            }
        });
    }

    return {
        cargarSeriales: (seriales) => {
            cargarSerialesEnSelect(serialSelect, seriales);
            if(busquedaInput) busquedaInput.value = '';
        },
        reset: () => {
            serialSelect.value = '';
            actualizarTrigger(picker);
        },
        getPicker: () => picker
    };
}
