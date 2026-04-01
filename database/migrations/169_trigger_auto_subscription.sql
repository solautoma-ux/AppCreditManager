-- MIGRATION: 169_trigger_auto_subscription.sql
-- DESCRIPTION: Trigger que garantiza la creación de suscripción al activar un admin (Backup definitivo del sistema)

-- 1. Función Trigger (Security Definer para saltar RLS)
CREATE OR REPLACE FUNCTION public.handle_admin_activation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    plan_mensual numeric := 500000;
    fecha_hoy date := CURRENT_DATE;
    fecha_vencimiento date := CURRENT_DATE + INTERVAL '30 days';
    new_sub_id uuid;
BEGIN
    -- Validamos nuevamente por seguridad (aunque el trigger tiene WHEN)
    IF NEW.rol = 'admin' AND NEW.estado = 'activo' THEN
        
        -- Verificar si YA TIENE suscripción (Idempotencia)
        IF NOT EXISTS (SELECT 1 FROM public.admin_subscriptions WHERE admin_id = NEW.id) THEN
            
            -- A. Crear Suscripción (Mensual por defecto)
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
                NEW.id,
                'mensual',
                plan_mensual,
                fecha_hoy,
                fecha_vencimiento,
                'activa',
                0,
                plan_mensual,
                fecha_hoy
            ) RETURNING id INTO new_sub_id;

            -- B. Registrar Pago Inicial
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
                NEW.id,
                new_sub_id,
                plan_mensual,
                fecha_hoy,
                to_char(fecha_hoy, 'YYYY-MM'),
                'transferencia',
                'Pago inicial - Activación Automática (Trigger DB)',
                NEW.id -- Se auto-registra a nombre del propio admin o sistema
            );
            
            RAISE NOTICE 'Suscripción auto-creada para admin %', NEW.email;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Crear Trigger en tabla usuarios
DROP TRIGGER IF EXISTS on_admin_activation ON public.usuarios;

CREATE TRIGGER on_admin_activation
AFTER UPDATE OF estado ON public.usuarios
FOR EACH ROW
WHEN (NEW.estado = 'activo' AND OLD.estado != 'activo' AND NEW.rol = 'admin')
EXECUTE FUNCTION public.handle_admin_activation();
