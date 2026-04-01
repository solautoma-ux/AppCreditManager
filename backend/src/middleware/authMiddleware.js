import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Middleware to verify Supabase JWT
 */
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Formato de token inválido.' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        // Attach user to request
        req.user = user;
        next();

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({ error: 'Error interno de autenticación.' });
    }
};
