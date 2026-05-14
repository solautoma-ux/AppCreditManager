-- MIGRATION: 181_fix_security_functions.sql
-- DESCRIPTION: Corrección masiva de advertencias del Supabase Security Advisor.
-- 1. Fija el search_path = public a todas las funciones (0011_function_search_path_mutable)
-- 2. Revoca la ejecución pública de funciones SECURITY DEFINER (0028 & 0029)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          -- Ignorar funciones del sistema o que pertenecen a extensiones de Supabase (pgsodium, graphql, etc.)
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d 
              WHERE d.objid = p.oid AND d.deptype = 'e'
          )
    LOOP
        -- 1. Fija el search_path para evitar vulnerabilidades de path mutable
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
        
        -- 2. Revoca permisos de ejecución externa para proteger la API REST pública
        -- El backend podrá seguir ejecutándolas si usa la service_role_key o triggers internos.
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
    END LOOP;
END;
$$;
