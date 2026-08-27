/**
 * Ejecuta fn dentro de una transacción de escritura.
 * Hace commit si fn resuelve; rollback si lanza error.
 */
export async function withTransaction(db, fn) {
    const tx = await db.transaction('write');
    try {
        const result = await fn(tx);
        await tx.commit();
        return result;
    } catch (error) {
        await tx.rollback();
        throw error;
    }
}

/** libSQL requiere { sql, args } dentro de transacciones. */
export function executeInTx(tx, sql, args = []) {
    return tx.execute({ sql, args });
}
