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

        // Guardar el token para usarlo en consultas con RLS (user-scoped)
        req.userToken = token;

        // Consultar la base de datos pública: primero por auth_id, si no por id directo
        let dbUser = null;

        const { data: byAuthId } = await supabase
            .from('usuarios')
            .select('id, rol, admin_padre_id')
            .eq('auth_id', user.id)
            .maybeSingle();

        if (byAuthId) {
            dbUser = byAuthId;
        } else {
            // Fallback: algunos usuarios tienen id == auth UUID directamente
            const { data: byId } = await supabase
                .from('usuarios')
                .select('id, rol, admin_padre_id')
                .eq('id', user.id)
                .maybeSingle();
            dbUser = byId;
        }

        // Attach user to request, combinando con datos de la BD
        // IMPORTANTE: db_id es el id de la tabla usuarios (usado como admin_id en carteras/clientes)
        req.user = {
            ...user,
            db_id: dbUser?.id || null,         // ID real en tabla usuarios
            rol: dbUser?.rol || null,
            admin_padre_id: dbUser?.admin_padre_id || null
        };

        next();

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({ error: 'Error interno de autenticación.' });
    }
};
