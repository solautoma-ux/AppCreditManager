-- Migration: Implement Scroring Logic based on Payment Behavior
-- Algorithm: Promptness Ratio (Active Payments / Total Due)

-- 1. Create Function to Calculate Score
CREATE OR REPLACE FUNCTION calcular_calificacion_cliente(p_cliente_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_exigibles INTEGER;
    v_pagos_a_tiempo INTEGER;
    v_nuevo_score INTEGER;
    v_nuevo_color VARCHAR;
BEGIN
    -- Contar cuotas que ya debieron pagarse (o ya se pagaron)
    -- Se consideran:
    -- 1. Pagadas (estado = 'pagada')
    -- 2. Vencidas (estado != 'pagada' AND fecha_vencimiento < TODAY)
    -- NO se consideran cuotas futuras (pendientes y vigentes)
    
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE a.estado = 'pagada' AND a.updated_at::date <= a.fecha_vencimiento)
    INTO 
        v_total_exigibles,
        v_pagos_a_tiempo
    FROM amortizaciones a
    JOIN creditos c ON a.credito_id = c.id
    WHERE c.cliente_id = p_cliente_id
      AND (
          a.estado = 'pagada' 
          OR 
          (a.fecha_vencimiento < CURRENT_DATE)
      );

    -- Lógica de Score
    IF v_total_exigibles = 0 THEN
        v_nuevo_score := 100; -- Score por defecto para nuevos
    ELSE
        -- Calculo entero simple: (A Tiempo / Total) * 100
        v_nuevo_score := (v_pagos_a_tiempo::NUMERIC / v_total_exigibles::NUMERIC * 100)::INTEGER;
    END IF;

    -- Asignar Color
    IF v_nuevo_score >= 90 THEN
        v_nuevo_color := 'verde';
    ELSIF v_nuevo_score >= 60 THEN
        v_nuevo_color := 'amarillo';
    ELSE
        v_nuevo_color := 'rojo';
    END IF;

    -- Actualizar Cliente
    UPDATE clientes
    SET 
        calificacion_score = v_nuevo_score,
        calificacion_color = v_nuevo_color,
        updated_at = NOW()
    WHERE id = p_cliente_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger on Pagos (Update score when a payment is made)
CREATE OR REPLACE FUNCTION trigger_update_score_on_pago()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_id UUID;
BEGIN
    -- Obtener cliente del credito pagado
    SELECT cliente_id INTO v_cliente_id
    FROM creditos
    WHERE id = NEW.credito_id;

    -- Recalcular
    PERFORM calcular_calificacion_cliente(v_cliente_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_score_pago ON pagos;
CREATE TRIGGER trg_update_score_pago
AFTER INSERT ON pagos
FOR EACH ROW
EXECUTE FUNCTION trigger_update_score_on_pago();

-- 3. Create Trigger on Amortizaciones (Update score if manually marked paid or changed)
-- Nota: Esto cubre actualizaciones, pero no el "paso del tiempo".
-- Para el paso del tiempo real (vencimiento diario), se requeriría un cron job (pg_cron)
-- o recalcular al visualizar. Por ahora triggers activos son suficientes para comportamiento reactivo.

CREATE OR REPLACE FUNCTION trigger_update_score_on_amortizacion()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_id UUID;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado) THEN
        SELECT cliente_id INTO v_cliente_id
        FROM creditos
        WHERE id = NEW.credito_id;

        PERFORM calcular_calificacion_cliente(v_cliente_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_score_amortizacion ON amortizaciones;
CREATE TRIGGER trg_update_score_amortizacion
AFTER UPDATE ON amortizaciones
FOR EACH ROW
EXECUTE FUNCTION trigger_update_score_on_amortizacion();

-- 4. Initial Calculation for ALL clients
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM clientes LOOP
        PERFORM calcular_calificacion_cliente(r.id);
    END LOOP;
END;
$$;
