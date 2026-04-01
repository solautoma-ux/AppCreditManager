-- MIGRATION: 128_rpc_vincular_cliente.sql
-- Description: RPC function to allow Encargados to link existing clients to their list.
-- This bypasses RLS during the linking process (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.vincular_cliente_encargado(
    p_cliente_id UUID,
    p_encargado_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_encargado_admin_padre UUID;
BEGIN
    -- 1. Get the admin_id of the client
    SELECT admin_id INTO v_admin_id FROM public.clientes WHERE id = p_cliente_id;
    
    -- 2. Get the admin_padre_id of the encargado to ensure they belong to the same admin
    SELECT admin_padre_id INTO v_encargado_admin_padre FROM public.usuarios WHERE id = p_encargado_id;

    -- 3. Safety check: ensure they belong to the same admin group
    IF v_admin_id IS NULL OR v_encargado_admin_padre IS NULL OR v_admin_id != v_encargado_admin_padre THEN
        RETURN jsonb_build_object('success', false, 'message', 'Error de seguridad: El cliente y el encargado no pertenecen al mismo grupo administrativo.');
    END IF;

    -- 4. Update the collaborators array (using array_append and ensuring uniqueness with array_distinct if we had it, but simple check is enough)
    -- Postgres doesn't have array_distinct natively in old versions, but we can check if it exists first
    IF NOT (p_encargado_id = ANY(COALESCE((SELECT colaboradores FROM public.clientes WHERE id = p_cliente_id), '{}'))) THEN
        UPDATE public.clientes
        SET colaboradores = array_append(COALESCE(colaboradores, '{}'), p_encargado_id)
        WHERE id = p_cliente_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Cliente vinculado exitosamente.');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.vincular_cliente_encargado TO authenticated;
