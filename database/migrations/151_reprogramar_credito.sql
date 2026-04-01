-- MIGRATION: 151_reprogramar_credito
-- Feature: Permitir cambiar la fecha de inicio SI NO hay pagos.
-- Logic: Actualiza creditos.fecha_inicio y recalcula fecha_vencimiento de amortizaciones.

CREATE OR REPLACE FUNCTION public.reprogramar_fecha_inicio_credito(
    p_credito_id UUID,
    p_nueva_fecha DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito RECORD;
    v_pagos_count INTEGER;
    v_cuota RECORD;
    v_nueva_vencimiento DATE;
    v_intervalo INTERVAL;
    v_dias_intervalo INTEGER;
BEGIN
    -- 1. Obtener datos del crédito
    SELECT * INTO v_credito
    FROM public.creditos
    WHERE id = p_credito_id;

    IF v_credito IS NULL THEN
        RAISE EXCEPTION 'Crédito no encontrado.';
    END IF;

    -- 2. Validar que NO tenga pagos
    SELECT COUNT(*) INTO v_pagos_count
    FROM public.pagos
    WHERE credito_id = p_credito_id;

    IF v_pagos_count > 0 THEN
        RAISE EXCEPTION 'No se puede reprogramar: El crédito ya tiene pagos registrados.';
    END IF;

    -- 3. Actualizar Fecha Inicio en Crédito
    -- Nota: También actualizamos fecha_vencimiento del crédito (plazo final) si fuera necesario, 
    -- pero el plazo total se deriva de las cuotas, así que recalculemos based on last quota later or here.
    -- Por simplicidad, recalculemos la lógica de intervalos:
    
    -- Determinar intervalo según frecuencia (normalizado a minúsculas)
    CASE LOWER(v_credito.frecuencia_pago)
        WHEN 'diaria' THEN v_intervalo := '1 day'::INTERVAL;
        WHEN 'semanal' THEN v_intervalo := '1 week'::INTERVAL;
		WHEN 'quincenal' THEN v_intervalo := '15 days'::INTERVAL;
        WHEN 'mensual' THEN v_intervalo := '1 month'::INTERVAL;
        WHEN 'unico' THEN v_intervalo := '0 days'::INTERVAL;
		WHEN 'anual' THEN v_intervalo := '1 year'::INTERVAL;
        ELSE 
            RAISE NOTICE 'Frecuencia desconocida: %. Usando mensual.', v_credito.frecuencia_pago;
             v_intervalo := '1 month'::INTERVAL;
    END CASE;

    -- Actualizar FECHA INICIO y PROXIMO PAGO
    UPDATE public.creditos
    SET 
        fecha_inicio = p_nueva_fecha,
        fecha_proximo_pago = p_nueva_fecha + v_intervalo -- Primera cuota
    WHERE id = p_credito_id;

    -- 4. Recalcular Amortizaciones
    -- Iteramos por número de cuota para reasignar fechas secuencialmente
    FOR v_cuota IN 
        SELECT id, numero_cuota 
        FROM public.amortizaciones 
        WHERE credito_id = p_credito_id 
        ORDER BY numero_cuota ASC
    LOOP
        -- Calcular nueva fecha: Inicio + (N * Intervalo)
        -- Ejemplo: Cuota 1 = Inicio + 1 mes
        -- Ejemplo Diario: Cuota 1 = Inicio + 1 dia
        
        -- Cálculo robusto de intervalos
        v_nueva_vencimiento := p_nueva_fecha + (v_intervalo * v_cuota.numero_cuota);

        UPDATE public.amortizaciones
        SET fecha_vencimiento = v_nueva_vencimiento
        WHERE id = v_cuota.id;
        
        -- Si es la última cuota, actualizar fecha_vencimiento del CREDITO
        IF v_cuota.numero_cuota = v_credito.numero_cuotas THEN
             UPDATE public.creditos
             SET fecha_vencimiento = v_nueva_vencimiento
             WHERE id = p_credito_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Crédito reprogramado exitosamente.',
        'nueva_fecha', p_nueva_fecha
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.reprogramar_fecha_inicio_credito TO authenticated;
