export function formatearFecha(fecha) {
    const fechaObjeto = new Date(fecha + "T00:00:00");
    const opcionesFormato = { day: "2-digit", month: "2-digit", year: "numeric" };
    const fechaFormateada = fechaObjeto.toLocaleDateString("es-ES", opcionesFormato);
    return fechaFormateada; 
}

export function fechaHoraVenezuela(date = new Date()) {
    const fecha = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Caracas',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);

    const hora = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Caracas',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(date);

    return { fecha, hora };
}