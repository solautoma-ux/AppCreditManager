-- MIGRATION: 168_link_account_rpc.sql (REFINADA)
-- DESCRIPTION: Función segura para vincular Auth Y asegurar suscripción inicial (IDEMPOTENTE).

-- Función Security Definer para vincular cuenta y asegurar suscripción
CREATE OR REPLACE FUNCTION public.vincular_cuenta_por_email(_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_user RECORD;
    new_sub_id uuid;
    plan_mensual numeric := 500000;
    fecha_hoy date := CURRENT_DATE;
    fecha_vencimiento date := CURRENT_DATE + INTERVAL '30 days';
    subscription_exists boolean;
BEGIN
    -- 1. Buscar usuario por email
    SELECT * INTO found_user
    FROM public.usuarios
    WHERE email = _email;

    -- 2. Validaciones Básicas
    IF found_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No se encontró invitación para este correo');
    END IF;

    -- Si ya está vinculado a OTRO auth_id, error
    IF found_user.auth_id IS NOT NULL AND found_user.auth_id != auth.uid() THEN
        RETURN json_build_object('success', false, 'message', 'Esta cuenta ya está vinculada a otro usuario');
    END IF;

    -- 3. Vincular Auth ID (Si no lo estaba)
    IF found_user.auth_id IS NULL THEN
        UPDATE public.usuarios
        SET auth_id = auth.uid(), updated_at = now()
        WHERE id = found_user.id;
    END IF;

    -- 4. Verificar si es ADMIN y asegurar suscripción
    IF found_user.rol = 'admin' THEN
        
        -- A. Asegurar estado activo
        IF found_user.estado != 'activo' THEN
            UPDATE public.usuarios SET estado = 'activo' WHERE id = found_user.id;
        END IF;

        -- B. Verificar si EXISTE suscripción
        SELECT EXISTS(SELECT 1 FROM public.admin_subscriptions WHERE admin_id = found_user.id) INTO subscription_exists;

        IF NOT subscription_exists THEN
            -- C. Crear Suscripción Inicial (Mensual por defecto)
            INSERT INTO public.admin_subscriptions (
                admin_id,
                tipo_plan,
                monto_mensual,
                fecha_inicio_suscripcion,
                fecha_proximo_pago,
                estado_suscripcion,
                dias_mora,
                total_pagado,
                fecha_ultimo_pago
            ) VALUES (
                found_user.id,
                'mensual',
                plan_mensual,
                fecha_hoy,
                fecha_vencimiento,
                'activa',
                0,
                plan_mensual,
                fecha_hoy
            ) RETURNING id INTO new_sub_id;

            -- D. Registrar Pago Inicial en Historial
            INSERT INTO public.subscription_payments (
                admin_id,
                subscription_id,
                monto_pagado,
                fecha_pago,
                mes_pagado,
                metodo_pago,
                notas,
                registrado_por_id
            ) VALUES (
                found_user.id,
                new_sub_id,
                plan_mensual,
                fecha_hoy,
                to_char(fecha_hoy, 'YYYY-MM'),
                'transferencia',
                'Pago inicial - Activación automática de cuenta',
                found_user.id -- Auto-registrado
            );
        END IF;
    END IF;
    
    -- Retornar el perfil actualizado
    SELECT * INTO found_user FROM public.usuarios WHERE id = found_user.id;

    RETURN json_build_object('success', true, 'data', row_to_json(found_user));
END;
$$;
