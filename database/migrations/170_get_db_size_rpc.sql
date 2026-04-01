-- MIGRATION: 170_get_db_size_rpc.sql
-- DESCRIPTION: Función RPC para obtener el tamaño actual de la base de datos (Monitoring)

CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Retorna el tamaño en bytes de la base de datos actual
    RETURN pg_database_size(current_database());
END;
$$;

-- Grant permissions (Adjust based on your security model, usually Authenticated is fine if app logic controls access)
GRANT EXECUTE ON FUNCTION public.get_database_size() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_database_size() TO service_role;
