-- MIGRATION: 140_overdue_and_refinance_logic
-- Objective: Functions for automatic state update and refinancing

-- 1. Function to update 'activo' credits to 'vencido' based on current date
CREATE OR REPLACE FUNCTION public.verificar_vencimientos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.creditos
    SET estado = 'vencido',
        updated_at = NOW()
    WHERE estado = 'activo'
      AND fecha_vencimiento < CURRENT_DATE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- 2. Function to refinance a credit
-- Concept: Creates a new credit and marks the old one as 'refinanciado'
CREATE OR REPLACE FUNCTION public.refinanciar_credito(
    p_credito_id UUID, -- ID del crédito viejo
    p_admin_id UUID,
    p_cartera_id UUID,
    p_monto_capital DECIMAL, -- Nuevo capital (usualmente el saldo pendiente del anterior)
    p_tasa_interes DECIMAL,
    p_monto_interes_calculado DECIMAL,
    p_monto_total DECIMAL,
    p_plazo_numero INTEGER,
    p_plazo_unidad VARCHAR,
    p_frecuencia_pago VARCHAR,
    p_numero_cuotas INTEGER,
    p_monto_cuota DECIMAL,
    p_fecha_inicio DATE,
    p_fecha_vencimiento DATE,
    p_cuotas_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_nuevo_credito_id UUID;
    v_old_saldo_capital DECIMAL;
    v_codigo_credito VARCHAR;
    v_num_refinanciamientos INTEGER;
BEGIN
    -- 1. Validar y obtener datos del crédito viejo
    SELECT saldo_capital_pendiente, numero_refinanciamientos
    INTO v_old_saldo_capital, v_num_refinanciamientos
    FROM public.creditos
    WHERE id = p_credito_id AND admin_id = p_admin_id
    FOR UPDATE;

    IF v_old_saldo_capital IS NULL THEN
        RAISE EXCEPTION 'Crédito no encontrado o sin permiso';
    END IF;

    -- 2. Cerrar el crédito viejo
    UPDATE public.creditos
    SET estado = 'refinanciado',
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 3. Generar Código Único para el nuevo
    v_codigo_credito := 'REF-' || floor(random() * 10000)::text || '-' || to_char(now(), 'MMDD');

    -- 4. Insertar Nuevo Crédito (similar a crear_credito_completo)
    INSERT INTO public.creditos (
        codigo, admin_id, cartera_id, cliente_id, creado_por_id,
        monto_capital, tasa_interes, monto_interes_calculado, monto_total,
        plazo_numero, plazo_unidad, frecuencia_pago, numero_cuotas, monto_cuota,
        fecha_inicio, fecha_vencimiento, fecha_proximo_pago,
        saldo_capital_pendiente, saldo_interes_pendiente,
        credito_padre_id, numero_refinanciamientos
    )
    SELECT 
        v_codigo_credito, p_admin_id, p_cartera_id, cliente_id, p_admin_id,
        p_monto_capital, p_tasa_interes, p_monto_interes_calculado, p_monto_total,
        p_plazo_numero, p_plazo_unidad, p_frecuencia_pago, p_numero_cuotas, p_monto_cuota,
        p_fecha_inicio, p_fecha_vencimiento, (p_cuotas_json->0->>'fecha_vencimiento')::DATE,
        p_monto_capital, p_monto_interes_calculado,
        p_credito_id, v_num_refinanciamientos + 1
    FROM public.creditos
    WHERE id = p_credito_id
    RETURNING id INTO v_nuevo_credito_id;

    -- 5. Insertar Amortizaciones
    INSERT INTO public.amortizaciones (
        credito_id, numero_cuota, fecha_vencimiento, monto_cuota, 
        capital_cuota, interes_cuota, saldo_pendiente, estado
    )
    SELECT 
        v_nuevo_credito_id,
        (value->>'numero')::INT,
        (value->>'fecha_vencimiento')::DATE,
        (value->>'monto_cuota')::DECIMAL,
        (value->>'capital')::DECIMAL,
        (value->>'interes')::DECIMAL,
        (value->>'monto_cuota')::DECIMAL,
        'pendiente'
    FROM jsonb_array_elements(p_cuotas_json);

    -- 6. Ajustar Saldo Cartera
    -- Simulación: Cerramos el viejo (capital vuelve a cartera) y abrimos el nuevo (se descuenta capital)
    -- El efecto neto es: saldo_prestado_nuevo - saldo_prestado_viejo
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + v_old_saldo_capital - p_monto_capital,
        saldo_prestado = saldo_prestado - v_old_saldo_capital + p_monto_capital,
        updated_at = NOW()
    WHERE id = p_cartera_id;

    -- 7. Incrementar contador en el cliente
    UPDATE public.clientes
    SET total_refinanciamientos = total_refinanciamientos + 1
    WHERE id = (SELECT cliente_id FROM public.creditos WHERE id = p_credito_id);

    RETURN jsonb_build_object(
        'success', true, 
        'old_credito_id', p_credito_id,
        'new_credito_id', v_nuevo_credito_id,
        'codigo', v_codigo_credito
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.verificar_vencimientos TO authenticated;
GRANT EXECUTE ON FUNCTION public.refinanciar_credito TO authenticated;
