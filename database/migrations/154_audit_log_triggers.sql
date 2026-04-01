-- Migration: 154_audit_log_triggers.sql
-- Description: Creates automatic audit triggers for all main tables.
-- Logs every INSERT, UPDATE, DELETE to the audit_log table.

-- Function to log INSERT operations
CREATE OR REPLACE FUNCTION public.fn_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.audit_log (
        usuario_id,
        accion,
        tabla_afectada,
        registro_id,
        campo_modificado,
        valor_anterior,
        valor_nuevo
    ) VALUES (
        public.current_user_id(),  -- Usuario actual (puede ser NULL si no está autenticado)
        'crear',
        TG_TABLE_NAME,
        NEW.id,
        NULL,  -- No hay campo específico en INSERT
        NULL,  -- No hay valor anterior
        to_json(NEW)::TEXT  -- Todo el registro nuevo como JSON
    );
    RETURN NEW;
END;
$$;

-- Function to log UPDATE operations (tracks each changed field)
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

-- Function to log DELETE operations
CREATE OR REPLACE FUNCTION public.fn_audit_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
        'eliminar',
        TG_TABLE_NAME,
        OLD.id,
        NULL,
        to_json(OLD)::TEXT,  -- Registro completo eliminado
        NULL
    );
    RETURN OLD;
END;
$$;

-- =====================================================
-- TRIGGERS FOR MAIN TABLES
-- =====================================================

-- 1. CARTERAS
DROP TRIGGER IF EXISTS trg_audit_carteras_insert ON public.carteras;
DROP TRIGGER IF EXISTS trg_audit_carteras_update ON public.carteras;
DROP TRIGGER IF EXISTS trg_audit_carteras_delete ON public.carteras;

CREATE TRIGGER trg_audit_carteras_insert
    AFTER INSERT ON public.carteras
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_insert();

CREATE TRIGGER trg_audit_carteras_update
    AFTER UPDATE ON public.carteras
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_update();

CREATE TRIGGER trg_audit_carteras_delete
    AFTER DELETE ON public.carteras
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_delete();

-- 2. CLIENTES
DROP TRIGGER IF EXISTS trg_audit_clientes_insert ON public.clientes;
DROP TRIGGER IF EXISTS trg_audit_clientes_update ON public.clientes;
DROP TRIGGER IF EXISTS trg_audit_clientes_delete ON public.clientes;

CREATE TRIGGER trg_audit_clientes_insert
    AFTER INSERT ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_insert();

CREATE TRIGGER trg_audit_clientes_update
    AFTER UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_update();

CREATE TRIGGER trg_audit_clientes_delete
    AFTER DELETE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_delete();

-- 3. CREDITOS
DROP TRIGGER IF EXISTS trg_audit_creditos_insert ON public.creditos;
DROP TRIGGER IF EXISTS trg_audit_creditos_update ON public.creditos;
DROP TRIGGER IF EXISTS trg_audit_creditos_delete ON public.creditos;

CREATE TRIGGER trg_audit_creditos_insert
    AFTER INSERT ON public.creditos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_insert();

CREATE TRIGGER trg_audit_creditos_update
    AFTER UPDATE ON public.creditos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_update();

CREATE TRIGGER trg_audit_creditos_delete
    AFTER DELETE ON public.creditos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_delete();

-- 4. PAGOS
DROP TRIGGER IF EXISTS trg_audit_pagos_insert ON public.pagos;
DROP TRIGGER IF EXISTS trg_audit_pagos_update ON public.pagos;
DROP TRIGGER IF EXISTS trg_audit_pagos_delete ON public.pagos;

CREATE TRIGGER trg_audit_pagos_insert
    AFTER INSERT ON public.pagos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_insert();

CREATE TRIGGER trg_audit_pagos_update
    AFTER UPDATE ON public.pagos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_update();

CREATE TRIGGER trg_audit_pagos_delete
    AFTER DELETE ON public.pagos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_delete();

-- 5. CARTERA_ENCARGADOS (Asignaciones)
DROP TRIGGER IF EXISTS trg_audit_cartera_encargados_insert ON public.cartera_encargados;
DROP TRIGGER IF EXISTS trg_audit_cartera_encargados_update ON public.cartera_encargados;
DROP TRIGGER IF EXISTS trg_audit_cartera_encargados_delete ON public.cartera_encargados;

CREATE TRIGGER trg_audit_cartera_encargados_insert
    AFTER INSERT ON public.cartera_encargados
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_insert();

CREATE TRIGGER trg_audit_cartera_encargados_update
    AFTER UPDATE ON public.cartera_encargados
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_update();

CREATE TRIGGER trg_audit_cartera_encargados_delete
    AFTER DELETE ON public.cartera_encargados
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_delete();

-- 6. USUARIOS (Para cambios de estado, rol, etc.)
DROP TRIGGER IF EXISTS trg_audit_usuarios_update ON public.usuarios;

CREATE TRIGGER trg_audit_usuarios_update
    AFTER UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_update();

-- Note: We don't audit INSERT on usuarios because that happens via auth trigger
-- Note: We don't audit DELETE on usuarios because we use soft-delete (estado='inactivo')
