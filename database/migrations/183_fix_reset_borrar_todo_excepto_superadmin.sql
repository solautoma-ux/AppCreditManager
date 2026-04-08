-- 183_fix_reset_borrar_todo_excepto_superadmin.sql
-- CORRECCIÓN: El reset debe borrar TODOS los datos excepto el Super Admin.
-- Esto incluye: admins, encargados, sus suscripciones, carteras, clientes, créditos, pagos.
-- Solo se preserva el usuario con rol = 'super_admin'.

CREATE OR REPLACE FUNCTION public.reset_sistema_completo()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role VARCHAR;
    v_super_admin_id UUID;
BEGIN
    -- 1. Verificar que quien llama es Super Admin
    SELECT rol, id INTO v_role, v_super_admin_id
    FROM public.usuarios
    WHERE auth_id = auth.uid();

    IF v_role IS DISTINCT FROM 'super_admin' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No autorizado. Solo Super Admin puede realizar esta acción.'
        );
    END IF;

    -- 2. Borrar todas las tablas transaccionales (CASCADE limpia dependencias)
    TRUNCATE TABLE
        public.audit_log,
        public.notificaciones_whatsapp,
        public.subscription_payments,
        public.pagos,
        public.amortizaciones,
        public.creditos,
        public.cartera_encargados,
        public.clientes,
        public.carteras
    RESTART IDENTITY CASCADE;

    -- 3. Borrar suscripciones de todos los admins (no del super admin)
    DELETE FROM public.admin_subscriptions
    WHERE admin_id != v_super_admin_id;

    -- 4. Borrar todos los usuarios EXCEPTO el Super Admin
    -- Los auth.users de Supabase Auth no se tocan aquí (requiere service_role)
    -- Solo borramos el registro en la tabla pública usuarios
    DELETE FROM public.usuarios
    WHERE rol IN ('admin', 'encargado');

    -- 5. Retornar éxito
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Sistema reseteado exitosamente. Solo el Super Admin fue preservado.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Error interno al resetear: ' || SQLERRM
    );
END;
$$;

-- Garantizar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.reset_sistema_completo() TO authenticated;
