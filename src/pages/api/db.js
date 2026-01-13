import { createClient } from '@libsql/client';

export const db = createClient({
    url: import.meta.env.DATABASE_URL,
    authToken: import.meta.env.DATABASE_AUTH_TOKEN
});