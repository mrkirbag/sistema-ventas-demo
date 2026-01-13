export function formatearFecha(fecha) {
    const fechaObjeto = new Date(fecha + "T00:00:00");
    const opcionesFormato = { day: "2-digit", month: "2-digit", year: "numeric" };
    const fechaFormateada = fechaObjeto.toLocaleDateString("es-ES", opcionesFormato);
    return fechaFormateada; 
}