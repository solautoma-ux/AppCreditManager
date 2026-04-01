-- Migration: Fix Scoring Logic for Interrupted Credits
-- ID: 161
-- Description: Updates the scoring function to penalize clients with 'interrumpido' credits by setting their score to 0.

CREATE OR REPLACE FUNCTION calcular_calificacion_cliente(p_cliente_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_exigibles INTEGER;
    v_pagos_a_tiempo INTEGER;
    v_tiene_interrumpido BOOLEAN;
    v_nuevo_score INTEGER;
    v_nuevo_color VARCHAR;
BEGIN
    -- 0. Verificar si tiene créditos interrumpidos
    SELECT EXISTS (
        SELECT 1 
        FROM creditos 
        WHERE cliente_id = p_cliente_id 
          AND estado = 'interrumpido'
    ) INTO v_tiene_interrumpido;

    -- Si tiene interrumpido, score 0 y rojo directo
    IF v_tiene_interrumpido THEN
        v_nuevo_score := 0;
        v_nuevo_color := 'rojo';
        
        UPDATE clientes
        SET 
            calificacion_score = v_nuevo_score,
            calificacion_color = v_nuevo_color,
            updated_at = NOW()
        WHERE id = p_cliente_id;
        
        RETURN;
    END IF;

    -- 1. Lógica Normal (si no tiene interrumpidos)
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
        v_nuevo_score := 100; -- Score por defecto
    ELSE
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
