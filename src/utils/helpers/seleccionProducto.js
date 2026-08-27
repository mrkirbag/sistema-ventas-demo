import { formatearMoneda, obtenerMonedaBase } from '@/utils/helpers/tasas.js';

const LIMITE_MAXIMO = 500;
const pickers = new WeakMap();
const pickersActivos = new Set();

let productosCache = [];
let cierreGlobalListo = false;

function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function textoStock(producto) {
    const stock = Number(producto.stock);
    const unidad = String(producto.unidad_medida || 'und').trim() || 'und';

    if (!Number.isFinite(stock)) return '—';
    return `${stock} ${unidad}`;
}

function textoPrecio(producto) {
    return formatearMoneda(Number(producto.venta) || 0, obtenerMonedaBase());
}

function claseStock(producto) {
    const stock = Number(producto.stock);
    if (!Number.isFinite(stock) || stock <= 0) return 'is-agotado';
    if (stock <= 5) return 'is-bajo';
    return '';
}

async function cargarTodosLosProductos() {
    const response = await fetch(`/api/productos?limit=${LIMITE_MAXIMO}`);

    if (!response.ok) throw new Error('Error al cargar productos');

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

function filtrarProductos(productos, termino) {
    const normalizado = String(termino ?? '').trim().toLowerCase();
    if (!normalizado) return productos;

    return productos.filter((producto) => {
        const codigo = String(producto.codigo ?? '').toLowerCase();
        const nombre = String(producto.nombre ?? '').toLowerCase();
        return codigo.includes(normalizado) || nombre.includes(normalizado);
    });
}

function htmlTrigger(producto) {
    if (!producto) {
        return '<span class="producto-picker_placeholder">Selecciona un producto</span>';
    }

    return `
        <span class="producto-picker_trigger-copy">
            <span class="producto-picker_trigger-code">${escapeHtml(String(producto.codigo || '').toUpperCase())}</span>
            <span class="producto-picker_trigger-name">${escapeHtml(String(producto.nombre || '').toUpperCase())}</span>
        </span>
        <span class="producto-picker_trigger-meta">
            <span>${escapeHtml(textoStock(producto))}</span>
            <span>${escapeHtml(textoPrecio(producto))}</span>
        </span>
    `;
}

function htmlItem(producto, seleccionado) {
    const stockClase = claseStock(producto);
    return `
        <button
            type="button"
            class="producto-picker_item ${seleccionado ? 'is-selected' : ''} ${stockClase}"
            role="option"
            data-id="${escapeHtml(producto.id)}"
            aria-selected="${seleccionado ? 'true' : 'false'}"
        >
            <span class="producto-picker_codigo">${escapeHtml(String(producto.codigo || '').toUpperCase())}</span>
            <span class="producto-picker_nombre">${escapeHtml(String(producto.nombre || '').toUpperCase())}</span>
            <span class="producto-picker_stock">${escapeHtml(textoStock(producto))}</span>
            <span class="producto-picker_precio">${escapeHtml(textoPrecio(producto))}</span>
        </button>
    `;
}

function productoPorId(id) {
    return productosCache.find((producto) => String(producto.id) === String(id)) || null;
}

function actualizarTrigger(picker) {
    const seleccionado = productoPorId(picker.select.value);
    picker.trigger.innerHTML = htmlTrigger(seleccionado);
    picker.trigger.classList.toggle('has-value', Boolean(seleccionado));
}

function posicionarPanel(picker) {
    const rect = picker.trigger.getBoundingClientRect();
    const margen = 12;
    const espacioAbajo = window.innerHeight - rect.bottom - margen;
    const espacioArriba = rect.top - margen;
    const abrirArriba = espacioAbajo < 220 && espacioArriba > espacioAbajo;
    const disponible = Math.max(abrirArriba ? espacioArriba : espacioAbajo, 160);
    const maxPanel = Math.min(380, disponible);

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
            if (event.target.closest('#busquedaProductos')) return;
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

function montarPicker(productoSelect) {
    const existente = pickers.get(productoSelect);
    if (existente) return existente;

    const wrap = document.createElement('div');
    wrap.className = 'producto-picker';
    productoSelect.parentNode.insertBefore(wrap, productoSelect);
    wrap.appendChild(productoSelect);
    productoSelect.classList.add('producto-picker_native');
    productoSelect.setAttribute('tabindex', '-1');
    productoSelect.setAttribute('aria-hidden', 'true');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'producto-picker_trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Seleccionar producto');

    const panel = document.createElement('div');
    panel.className = 'producto-picker_panel';
    panel.hidden = true;

    panel.innerHTML = `
        <div class="producto-picker_head" aria-hidden="true">
            <span>Código</span>
            <span>Producto</span>
            <span>Stock</span>
            <span>Precio</span>
        </div>
        <div class="producto-picker_list" role="listbox"></div>
    `;

    const list = panel.querySelector('.producto-picker_list');
    wrap.appendChild(trigger);
    wrap.appendChild(panel);

    const picker = { select: productoSelect, wrap, trigger, panel, list };
    pickers.set(productoSelect, picker);
    pickersActivos.add(productoSelect);
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
        const item = event.target.closest('[data-id]');
        if (!item) return;
        seleccionarProducto(picker, item.dataset.id);
    });

    actualizarTrigger(picker);
    return picker;
}

function seleccionarProducto(picker, id) {
    picker.select.value = String(id);
    picker.select.dispatchEvent(new Event('change', { bubbles: true }));
    actualizarTrigger(picker);
    setAbierto(picker, false);
}

function renderLista(picker, productos = null) {
    const lista = productos ?? filtrarProductos(productosCache, '');
    const seleccionadoId = String(picker.select.value || '');

    if (!lista.length) {
        picker.list.innerHTML = `
            <p class="producto-picker_empty">
                ${productosCache.length ? 'No hay coincidencias' : 'No hay productos disponibles'}
            </p>
        `;
        return;
    }

    picker.list.innerHTML = lista.map((producto) => (
        htmlItem(producto, String(producto.id) === seleccionadoId)
    )).join('');

    if (!picker.panel.hidden) {
        posicionarPanel(picker);
    }
}

export function cargarProductosEnSelect(productoSelect, productos) {
    const picker = montarPicker(productoSelect);
    const valorActual = productoSelect.value;
    productoSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.textContent = productos.length ? 'Selecciona un producto' : 'No hay productos disponibles';
    productoSelect.appendChild(defaultOption);

    const fragment = document.createDocumentFragment();
    productos.forEach((producto) => {
        const option = document.createElement('option');
        option.value = String(producto.id);
        option.textContent = String(producto.nombre || '');
        fragment.appendChild(option);
    });
    productoSelect.appendChild(fragment);

    const sigueDisponible = productos.some((producto) => String(producto.id) === String(valorActual));
    productoSelect.value = sigueDisponible ? valorActual : '';
    if (!productoSelect.value) {
        defaultOption.selected = true;
    }

    renderLista(picker, productos);
    actualizarTrigger(picker);
}

function enfocarCantidad(cantidadInput) {
    if (!(cantidadInput instanceof HTMLInputElement)) return;

    if (!cantidadInput.value) {
        cantidadInput.value = '1';
    }

    requestAnimationFrame(() => {
        cantidadInput.focus();
        cantidadInput.select();
    });
}

function renderProductosFiltrados(productoSelect, termino = '') {
    cargarProductosEnSelect(productoSelect, filtrarProductos(productosCache, termino));
}

export function crearModuloProductos({
    productoSelect,
    cantidadInput,
    onNoEncontrado,
}) {
    const picker = montarPicker(productoSelect);
    const busquedaInput = document.getElementById('busquedaProductos');

    cargarProductosEnSelect(productoSelect, []);

    productoSelect.addEventListener('change', () => {
        if (!productoSelect.value) return;
        enfocarCantidad(cantidadInput);
    });

    if (busquedaInput instanceof HTMLInputElement) {
        busquedaInput.addEventListener('input', () => {
            renderProductosFiltrados(productoSelect, busquedaInput.value);
            if (busquedaInput.value.trim()) {
                setAbierto(picker, true);
            }
        });
    }

    cargarTodosLosProductos()
        .then((productos) => {
            productosCache = productos;
            const termino = busquedaInput instanceof HTMLInputElement
                ? busquedaInput.value
                : '';
            renderProductosFiltrados(productoSelect, termino);
        })
        .catch((error) => {
            console.error('Error al cargar productos:', error);
            onNoEncontrado?.('Error al cargar los productos.');
        });

    return {};
}

export function enfocarBusquedaProductos() {
    document.getElementById('busquedaProductos')?.focus();
}

export function reiniciarBusquedaProductos() {
    const busqueda = document.getElementById('busquedaProductos');
    const productoSelect = document.getElementById('productoSelect');

    if (busqueda instanceof HTMLInputElement) {
        busqueda.value = '';
    }

    if (productoSelect instanceof HTMLSelectElement) {
        productoSelect.value = '';
        renderProductosFiltrados(productoSelect, '');
        const picker = pickers.get(productoSelect);
        if (picker) {
            actualizarTrigger(picker);
            setAbierto(picker, false);
        }
    }
}
