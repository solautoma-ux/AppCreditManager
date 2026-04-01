-- MIGRATION: 166_fix_reset_system.sql
-- Purpose: Fix constraint violation in reset_sistema_completo by using TRUNCATE CASCADE
-- and including new tables.

CREATE OR REPLACE FUNCTION public.reset_sistema_completo()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role VARCHAR;
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

    -- 2. Execute Truncate (Much faster and bypasses row triggers)
    -- We truncate the main transactional tables. 
    -- CASCADE will automatically clean up dependent tables (like pagos referencing creditos)
    
    TRUNCATE TABLE 
        public.audit_log, -- Historial de actividades (limpieza total)
        public.notificaciones_whatsapp,
        public.subscription_payments, -- Historial de pagos de admins (opcional, pero consistente con "reset total")
        public.pagos,
        public.amortizaciones, -- Si existe
        public.creditos,
        public.cartera_encargados,
        public.clientes,
        public.carteras
    RESTART IDENTITY CASCADE;

    -- Nota: NO borramos usuarios ni admin_subscriptions para no bloquear el acceso al sistema.
    -- Si se quisiera borrar suscripciones, agregar public.admin_subscriptions a la lista.

    -- 3. Return success
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Sistema reseteado exitosamente (Tablas truncadas).'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'message', 'Error interno al resetear: ' || SQLERRM
    );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.reset_sistema_completo TO authenticated;
