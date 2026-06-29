const LIMITE_BUSQUEDA = 50;
const LIMITE_LISTA = 80;
const LIMITE_MAXIMO = 500;

export function normalizarCodigo(valor) {
    return String(valor ?? '')
        .replace(/[\r\n\t]+/g, '')
        .trim();
}

async function buscarProductoPorApi(codigo) {
    const normalizado = normalizarCodigo(codigo);
    if (!normalizado) return null;

    const response = await fetch(
        `/api/productos?codigo=${encodeURIComponent(normalizado)}`
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Error al buscar producto');

    return response.json();
}

async function buscarProductosPorTexto(termino) {
    const response = await fetch(
        `/api/productos?search=${encodeURIComponent(termino)}&limit=${LIMITE_BUSQUEDA}`
    );

    if (!response.ok) throw new Error('Error al buscar productos');

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

export function cargarProductosEnSelect(productoSelect, productos) {
    productoSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = productos.length
        ? 'Selecciona un producto'
        : 'Busca o escanea un producto';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    productoSelect.appendChild(defaultOption);

    if (!productos.length) {
        return;
    }

    const fragment = document.createDocumentFragment();

    productos.forEach((producto) => {
        const option = document.createElement('option');
        option.value = String(producto.id);
        option.textContent = `${String(producto.codigo).toUpperCase()} - ${producto.nombre} - ${producto.stock} ${producto.unidad_medida} - ${producto.venta}USD`;
        option.dataset.codigo = String(producto.codigo ?? '').toLowerCase();
        option.dataset.nombre = String(producto.nombre ?? '').toLowerCase();
        fragment.appendChild(option);
    });

    productoSelect.appendChild(fragment);
}

function asegurarOpcionEnSelect(productoSelect, producto) {
    const id = String(producto.id);
    const existe = Array.from(productoSelect.options).some(
        (option) => option.value === id
    );

    if (!existe) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${String(producto.codigo).toUpperCase()} - ${producto.nombre} - ${producto.stock} ${producto.unidad_medida} - ${producto.venta}USD`;
        option.dataset.codigo = String(producto.codigo ?? '').toLowerCase();
        option.dataset.nombre = String(producto.nombre ?? '').toLowerCase();
        productoSelect.appendChild(option);
    }
}

function marcarProductoEnSelect(productoSelect, producto) {
    const id = String(producto.id);
    asegurarOpcionEnSelect(productoSelect, producto);

    for (let i = 0; i < productoSelect.options.length; i++) {
        const option = productoSelect.options[i];
        option.selected = option.value === id;
    }

    productoSelect.value = id;
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

export function crearModuloProductos({
    productoSelect,
    cantidadInput,
    onNoEncontrado,
    onProductoSeleccionado,
}) {
    let debounceEscaneo = null;
    let debounceBusqueda = null;
    let escaneoEnCurso = false;
    let busquedaEnCurso = false;

    const codigoBarrasInput = document.getElementById('codigoBarras');
    const busquedaInput = document.getElementById('busquedaProductos');

    cargarProductosEnSelect(productoSelect, []);

    const seleccionarProducto = (producto) => {
        marcarProductoEnSelect(productoSelect, producto);
        onProductoSeleccionado?.(producto);
        enfocarCantidad(cantidadInput);
    };

    const procesarEscaneo = async () => {
        if (!(codigoBarrasInput instanceof HTMLInputElement) || escaneoEnCurso) {
            return false;
        }

        const codigo = normalizarCodigo(codigoBarrasInput.value);
        if (!codigo) return false;

        escaneoEnCurso = true;
        let seleccionado = false;

        try {
            const producto = await buscarProductoPorApi(codigo);

            if (!producto) {
                onNoEncontrado?.(`No se encontro producto con codigo: ${codigo}`);
                codigoBarrasInput.select();
                return false;
            }

            codigoBarrasInput.value = '';
            seleccionarProducto(producto);
            seleccionado = true;
            return true;
        } catch (error) {
            console.error('Error al buscar producto escaneado:', error);
            onNoEncontrado?.('Error al buscar el producto. Intenta de nuevo.');
            return false;
        } finally {
            escaneoEnCurso = false;
            if (!seleccionado) {
                codigoBarrasInput.focus();
            }
        }
    };

    const esEnter = (event) =>
        event.key === 'Enter' || event.key === 'NumpadEnter' || event.keyCode === 13;

    if (codigoBarrasInput instanceof HTMLInputElement) {
        const manejarEnter = (event) => {
            if (!esEnter(event)) return;
            event.preventDefault();
            event.stopPropagation();
            clearTimeout(debounceEscaneo);
            procesarEscaneo();
        };

        codigoBarrasInput.addEventListener('keydown', manejarEnter);
        codigoBarrasInput.addEventListener('keypress', manejarEnter);

        codigoBarrasInput.addEventListener('input', () => {
            clearTimeout(debounceEscaneo);
            debounceEscaneo = window.setTimeout(procesarEscaneo, 100);
        });

        codigoBarrasInput.focus();
    }

    productoSelect.addEventListener('change', () => {
        if (!productoSelect.value) return;
        enfocarCantidad(cantidadInput);
    });

    if (busquedaInput instanceof HTMLInputElement) {
        busquedaInput.addEventListener('input', () => {
            clearTimeout(debounceBusqueda);

            const termino = busquedaInput.value.trim();
            if (!termino) {
                cargarProductosEnSelect(productoSelect, []);
                return;
            }

            debounceBusqueda = window.setTimeout(async () => {
                if (busquedaEnCurso) return;
                busquedaEnCurso = true;

                try {
                    const productos = await buscarProductosPorTexto(termino);
                    cargarProductosEnSelect(productoSelect, productos);
                } catch (error) {
                    console.error('Error al buscar productos:', error);
                    onNoEncontrado?.('Error al buscar productos.');
                } finally {
                    busquedaEnCurso = false;
                }
            }, 300);
        });
    }

    return {};
}

export function enfocarLectorCodigoBarras() {
    document.getElementById('codigoBarras')?.focus();
}

export function reiniciarBusquedaProductos() {
    const busqueda = document.getElementById('busquedaProductos');
    const codigoBarras = document.getElementById('codigoBarras');
    const productoSelect = document.getElementById('productoSelect');

    if (busqueda instanceof HTMLInputElement) {
        busqueda.value = '';
    }

    if (codigoBarras instanceof HTMLInputElement) {
        codigoBarras.value = '';
    }

    if (productoSelect instanceof HTMLSelectElement) {
        cargarProductosEnSelect(productoSelect, []);
    }
}
