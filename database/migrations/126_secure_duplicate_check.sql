-- MIGRATION: 126_secure_duplicate_check.sql
-- Purpose: Allow Encargados to check for duplicate clients across the entire Admin scope
-- bypassing RLS restrictions that only show their own created clients.

-- Function to check duplicate client securely
-- Returns basic info if found (id, nombre, apellido, creado_por_id)
CREATE OR REPLACE FUNCTION public.check_cliente_duplicate_secure(
    p_cedula VARCHAR,
    p_admin_id UUID
)
RETURNS TABLE (
    id UUID,
    nombre VARCHAR,
    apellido VARCHAR,
    creado_por_id UUID,
    admin_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin), bypassing RLS
SET search_path = public -- Secure search path
AS $$
BEGIN
    -- Return the client if it exists within the same admin_id
    RETURN QUERY
    SELECT c.id, c.nombre, c.apellido, c.creado_por_id, c.admin_id
    FROM public.clientes c
    WHERE c.cedula = p_cedula 
    AND c.admin_id = p_admin_id
    LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_cliente_duplicate_secure TO authenticated;
