-- MIGRATION: 129_reset_system.sql
-- Purpose: Create a Secure RPC to reset all transactional data (Factory Reset)
-- Only Super Admin can execute this.

CREATE OR REPLACE FUNCTION public.reset_sistema_completo()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Executed with elevated privileges
SET search_path = public
AS $$
DECLARE
    v_role VARCHAR;
    v_deleted_pagos INT;
    v_deleted_amortizaciones INT;
    v_deleted_creditos INT;
    v_deleted_carteras INT;
    v_deleted_clientes INT;
BEGIN
    -- 1. Security Check: Verify if caller is Super Admin
    SELECT rol INTO v_role 
    FROM public.usuarios 
    WHERE auth_id = auth.uid();

    IF v_role IS DISTINCT FROM 'super_admin' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'No autorizado. Solo Super Admin puede realizar esta acción.'
        );
    END IF;

    -- 2. Execute Deletions ( Order matters for FK constraints )
    
    -- Level 4 (Deepest Dependencies)
    DELETE FROM public.pagos WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_deleted_pagos = ROW_COUNT;

    -- Level 3
    DELETE FROM public.amortizaciones WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_deleted_amortizaciones = ROW_COUNT;

    -- Level 2
    DELETE FROM public.creditos WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_deleted_creditos = ROW_COUNT;

    -- Level 1 (Relations)
    DELETE FROM public.cartera_encargados WHERE id IS NOT NULL;
    
    -- Level 0 (Main Transactional Entities)
    DELETE FROM public.carteras WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_deleted_carteras = ROW_COUNT;

    DELETE FROM public.clientes WHERE id IS NOT NULL;
    GET DIAGNOSTICS v_deleted_clientes = ROW_COUNT;

    -- Optional: Reset sequences if using SERIAL (but UUIDs don't need this)
    
    -- 3. Return summary
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Sistema reseteado exitosamente.',
        'stats', jsonb_build_object(
            'pagos', v_deleted_pagos,
            'amortizaciones', v_deleted_amortizaciones,
            'creditos', v_deleted_creditos,
            'carteras', v_deleted_carteras,
            'clientes', v_deleted_clientes
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'message', 'Error interno al resetear: ' || SQLERRM
    );
END;
$$;

-- Grant execute to authenticated (RLS inside function handles restriction)
GRANT EXECUTE ON FUNCTION public.reset_sistema_completo TO authenticated;
