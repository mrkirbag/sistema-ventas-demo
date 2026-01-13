import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export function verificarToken(request) {
    const cookie = request.headers.get('cookie');
    if (!cookie) return null;
    const token = cookie.split('token=')[1]?.split(';')[0];
    if (!token) return null;
    try {
        const JWT_SECRET = import.meta.env.JWT_SECRET;
        const payload = jwt.verify(token, JWT_SECRET);
        return payload;
    } catch (err) {
        return null;
    }
}
