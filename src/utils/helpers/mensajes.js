export function noRegistros(mensaje) {
    const errorCampo = document.getElementById('mensaje');

    if(mensaje == ""){
        errorCampo.style.display = "none";
    } else {
        errorCampo.style.display = "block"
        errorCampo.textContent = mensaje;
        errorCampo.classList.add('mensaje-sin-registros');
    }
}

function mostrarModal(mensaje, clase) {
    const modal = document.getElementById('modal');
    const overlay = document.getElementById('overlay');

    modal.textContent = mensaje;
    modal.classList.add(clase);

    overlay.classList.remove('oculto');
    overlay.classList.add('visible');

    setTimeout(() => {
        overlay.classList.remove('visible');
        overlay.classList.add('oculto');
        modal.classList.remove(clase);
        modal.textContent = '';
    }, 1000);
}

export function mostrarMensaje(mensaje) {
    mostrarModal(mensaje, 'mensaje-exito');
}

export function mostrarError(mensaje) {
    mostrarModal(mensaje, 'mensaje-error');
}
