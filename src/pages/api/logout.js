export async function POST() {
    return new Response(JSON.stringify({ mensaje: 'Sesión cerrada' }), {
        status: 200,
        headers: {
        'Set-Cookie': 'token=; HttpOnly; Path=/; Max-Age=0',
        'Content-Type': 'application/json'
        }
    });
}
