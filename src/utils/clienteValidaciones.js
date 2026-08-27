const NOMBRE_MIN = 3;
const NOMBRE_MAX = 80;
const TELEFONO_MIN = 10;
const TELEFONO_MAX = 13;
const DIRECCION_MIN = 5;
const DIRECCION_MAX = 120;

/**
 * @typedef {{ ok: true, valor: string }} CampoValido
 * @typedef {{ ok: false, error: string }} CampoInvalido
 * @typedef {CampoValido | CampoInvalido} ResultadoCampo
 * @typedef {{ nombre: string, cedula: string, telefono: string, direccion?: string }} ClienteValidado
 * @typedef {{ ok: true, cliente: ClienteValidado } | { ok: false, error: string }} ResultadoCliente
 */

function texto(valor) {
    return String(valor ?? '').trim();
}

export function normalizarNombre(valor) {
    return texto(valor).replace(/\s+/g, ' ');
}

export function documentoComparable(valor) {
    return texto(valor).toUpperCase().replace(/[.\s-]/g, '');
}

/** @returns {ResultadoCampo} */
export function validarNombre(valor) {
    const nombre = normalizarNombre(valor);

    if (!nombre) {
        return { ok: false, error: 'El nombre es obligatorio' };
    }

    if (nombre.length < NOMBRE_MIN) {
        return { ok: false, error: 'El nombre debe tener al menos 3 caracteres' };
    }

    if (nombre.length > NOMBRE_MAX) {
        return { ok: false, error: 'El nombre no puede superar 80 caracteres' };
    }

    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.'’ -]+$/.test(nombre)) {
        return { ok: false, error: 'El nombre solo puede contener letras, espacios, puntos y guiones' };
    }

    if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(nombre)) {
        return { ok: false, error: 'El nombre debe incluir letras válidas' };
    }

    const palabras = nombre.split(' ').filter(Boolean);
    if (palabras.length < 2) {
        return { ok: false, error: 'Ingresa nombre y apellido' };
    }

    if (palabras.some((palabra) => !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(palabra))) {
        return { ok: false, error: 'Cada parte del nombre debe incluir letras' };
    }

    return { ok: true, valor: nombre };
}

/** @returns {ResultadoCampo} */
export function validarCedulaORif(valor) {
    const crudo = texto(valor).toUpperCase().replace(/\s+/g, '');

    if (!crudo) {
        return { ok: false, error: 'La cédula o RIF es obligatorio' };
    }

    if (!/^[A-Z0-9-]+$/.test(crudo)) {
        return { ok: false, error: 'La cédula o RIF solo puede contener letras, números y guiones' };
    }

    const rif = crudo.match(/^([VEJGCP])-?(\d{8})-?(\d)$/);
    if (rif) {
        return { ok: true, valor: `${rif[1]}-${rif[2]}-${rif[3]}` };
    }

    const cedulaPrefijo = crudo.match(/^([VE])-?([1-9]\d{5,8})$/);
    if (cedulaPrefijo) {
        return { ok: true, valor: `${cedulaPrefijo[1]}-${cedulaPrefijo[2]}` };
    }

    if (/^[1-9]\d{5,9}$/.test(crudo)) {
        return { ok: true, valor: crudo };
    }

    return {
        ok: false,
        error: 'Ingresa una cédula (6 a 10 dígitos) o un RIF válido. Ej. 12345678 o J-12345678-9',
    };
}

/** @returns {ResultadoCampo} */
export function validarTelefono(valor) {
    const original = texto(valor);

    if (!original) {
        return { ok: false, error: 'El teléfono es obligatorio' };
    }

    if (!/^[+\d][\d\s().-]*$/.test(original)) {
        return { ok: false, error: 'El teléfono solo puede contener números, espacios, paréntesis, guiones o +' };
    }

    const digitos = original.replace(/\D/g, '');

    if (digitos.length < TELEFONO_MIN || digitos.length > TELEFONO_MAX) {
        return { ok: false, error: 'El teléfono debe tener entre 10 y 13 dígitos' };
    }

    if (/^(\d)\1+$/.test(digitos)) {
        return { ok: false, error: 'Ingresa un número de teléfono válido' };
    }

    return { ok: true, valor: digitos };
}

/** @returns {ResultadoCampo} */
export function validarDireccion(valor) {
    const direccion = texto(valor).replace(/\s+/g, ' ');

    if (!direccion) {
        return { ok: false, error: 'La dirección es obligatoria' };
    }

    if (direccion.length < DIRECCION_MIN) {
        return { ok: false, error: 'La dirección debe tener al menos 5 caracteres' };
    }

    if (direccion.length > DIRECCION_MAX) {
        return { ok: false, error: 'La dirección no puede superar 120 caracteres' };
    }

    if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(direccion)) {
        return { ok: false, error: 'La dirección debe incluir letras o números' };
    }

    return { ok: true, valor: direccion };
}

/**
 * @param {{ nombre?: unknown, telefono?: unknown, cedula?: unknown, direccion?: unknown }} [datos]
 * @returns {ResultadoCliente}
 */
export function validarCliente({ nombre, telefono, cedula, direccion } = {}) {
    const nombreOk = validarNombre(nombre);
    if (!nombreOk.ok) return { ok: false, error: nombreOk.error };

    const documentoOk = validarCedulaORif(cedula);
    if (!documentoOk.ok) return { ok: false, error: documentoOk.error };

    const telefonoOk = validarTelefono(telefono);
    if (!telefonoOk.ok) return { ok: false, error: telefonoOk.error };

    /** @type {ClienteValidado} */
    const cliente = {
        nombre: nombreOk.valor,
        cedula: documentoOk.valor,
        telefono: telefonoOk.valor,
    };

    if (direccion !== undefined) {
        const direccionOk = validarDireccion(direccion);
        if (!direccionOk.ok) return { ok: false, error: direccionOk.error };
        cliente.direccion = direccionOk.valor;
    }

    return { ok: true, cliente };
}
