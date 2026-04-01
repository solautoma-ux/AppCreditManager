-- Migration: 156_filter_audit_noise.sql
-- Description: Cleans up existing noise from audit_log and updates trigger to prevent future noise.

-- 1. CLEANUP EXISTING NOISE
-- Delete system-generated updates that are irrelevant for the user
DELETE FROM public.audit_log
WHERE 
    accion = 'actualizar' 
    AND (
        -- Hide balance and timestamp updates on Carteras
        (tabla_afectada = 'carteras' AND campo_modificado IN ('saldo_actual', 'saldo_prestado', 'registro_pagos_id', 'updated_at'))
        OR
        -- Hide balance and timestamp updates on Creditos
        (tabla_afectada = 'creditos' AND campo_modificado IN ('saldo_capital_pendiente', 'saldo_interes_pendiente', 'updated_at'))
        OR
        -- Hide technical updates on Clientes (Allowlist: only show relevant profile fields)
        (tabla_afectada = 'clientes' AND campo_modificado NOT IN ('nombre', 'apellido', 'cedula', 'movil', 'email', 'direccion', 'estado')) 
        OR
        -- Hide all updates on Amortizaciones (if any exist)
        (tabla_afectada = 'amortizaciones')
        OR
        -- Hide technical fields in Payments
        (tabla_afectada = 'pagos' AND campo_modificado IN ('updated_at'))
        OR
        -- Hide updated_at generally
        (campo_modificado = 'updated_at')
    );

-- 2. UPDATE TRIGGER FUNCTION TO PREVENT FUTURE NOISE
CREATE OR REPLACE FUNCTION public.fn_audit_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_json JSONB;
    v_new_json JSONB;
    v_key TEXT;
    v_old_val TEXT;
    v_new_val TEXT;
BEGIN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    
    -- Loop through each key in the old record
    FOR v_key IN SELECT jsonb_object_keys(v_old_json)
    LOOP
        v_old_val := v_old_json ->> v_key;
        v_new_val := v_new_json ->> v_key;
        
        -- Skip if values are the same or if it's a timestamp field
        IF v_old_val IS DISTINCT FROM v_new_val AND v_key NOT IN ('updated_at', 'created_at') THEN
            
            -- DATA SAVING FILTER: Skip system fields
            
            -- Carteras: Skip balance updates
            IF TG_TABLE_NAME = 'carteras' AND v_key IN ('saldo_actual', 'saldo_prestado', 'registro_pagos_id') THEN
                CONTINUE;
            END IF;

            -- Creditos: Skip balance updates
            IF TG_TABLE_NAME = 'creditos' AND v_key IN ('saldo_capital_pendiente', 'saldo_interes_pendiente') THEN
                CONTINUE;
            END IF;

            -- Clientes: Only allow profile fields (Whitelist)
            IF TG_TABLE_NAME = 'clientes' AND v_key NOT IN ('nombre', 'apellido', 'cedula', 'movil', 'email', 'direccion', 'estado') THEN
                CONTINUE;
            END IF;
            
            -- Insert only if it passed the filters
            INSERT INTO public.audit_log (
                usuario_id,
                accion,
                tabla_afectada,
                registro_id,
                campo_modificado,
                valor_anterior,
                valor_nuevo
            ) VALUES (
                public.current_user_id(),
                'actualizar',
                TG_TABLE_NAME,
                NEW.id,
                v_key,
                v_old_val,
                v_new_val
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$;
