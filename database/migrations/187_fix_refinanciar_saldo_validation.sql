-- MIGRATION: 187_fix_refinanciar_saldo_validation.sql
-- Description: Añade validación de saldo al refinanciar un crédito. 
-- Previene que se refinancie por un monto superior al saldo disponible 
-- (solo valida el delta o excedente solicitado).

CREATE OR REPLACE FUNCTION public.refinanciar_credito(
    p_credito_id UUID,
    p_admin_id UUID,
    p_cartera_id UUID,
    p_monto_capital DECIMAL,
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
    v_nuevo_credito_id     UUID;
    v_old_saldo_capital    DECIMAL;
    v_old_saldo_interes    DECIMAL;
    v_codigo_credito       VARCHAR;
    v_cliente_id           UUID;
    v_total_devuelto       DECIMAL;
    v_delta_requerido      DECIMAL;
    v_saldo_actual         DECIMAL;
BEGIN
    -- 1. Obtener datos del crédito viejo (capital E interés pendientes)
    SELECT saldo_capital_pendiente, saldo_interes_pendiente, cliente_id
    INTO v_old_saldo_capital, v_old_saldo_interes, v_cliente_id
    FROM public.creditos
    WHERE id = p_credito_id AND admin_id = p_admin_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédito no encontrado o no pertenece al admin';
    END IF;

    -- Calcular delta requerido (si es mayor a 0, significa que pide dinero adicional)
    v_total_devuelto := v_old_saldo_capital + v_old_saldo_interes;
    v_delta_requerido := p_monto_capital - v_total_devuelto;

    -- 1.5 Validar Saldo Cartera
    -- Bloquear cartera y verificar saldo si se solicita más capital del adeudado
    IF v_delta_requerido > 0 THEN
        SELECT saldo_actual INTO v_saldo_actual
        FROM public.carteras
        WHERE id = p_cartera_id AND admin_id = p_admin_id
        FOR UPDATE;

        IF v_saldo_actual IS NULL THEN
            RAISE EXCEPTION 'Cartera no encontrada o sin permiso';
        END IF;

        IF v_saldo_actual < v_delta_requerido THEN
            RAISE EXCEPTION 'Saldo insuficiente en la cartera para refinanciar (Adicional requerido: %, Disponible: %)', v_delta_requerido, v_saldo_actual;
        END IF;
    END IF;

    -- 2. Cerrar el crédito original marcándolo como 'refinanciado'
    UPDATE public.creditos
    SET estado                 = 'refinanciado',
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        updated_at              = NOW()
    WHERE id = p_credito_id;

    -- 3. Generar código para el nuevo crédito
    v_codigo_credito := 'CR-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0') || '-' || TO_CHAR(NOW(), 'MMDD');

    -- 4. Crear el nuevo crédito refinanciado
    INSERT INTO public.creditos (
        admin_id, cartera_id, cliente_id, codigo, creado_por_id,
        monto_capital, tasa_interes, monto_interes_calculado, monto_total,
        plazo_numero, plazo_unidad, frecuencia_pago, numero_cuotas, monto_cuota,
        fecha_inicio, fecha_vencimiento, fecha_proximo_pago,
        saldo_capital_pendiente, saldo_interes_pendiente,
        estado, credito_padre_id
    ) VALUES (
        p_admin_id, p_cartera_id, v_cliente_id, v_codigo_credito, p_admin_id,
        p_monto_capital, p_tasa_interes, p_monto_interes_calculado, p_monto_total,
        p_plazo_numero, p_plazo_unidad, p_frecuencia_pago, p_numero_cuotas, p_monto_cuota,
        p_fecha_inicio, p_fecha_vencimiento, (p_cuotas_json->0->>'fecha_vencimiento')::DATE,
        p_monto_capital, p_monto_interes_calculado,
        'activo', p_credito_id
    )
    RETURNING id INTO v_nuevo_credito_id;

    -- 5. Crear el plan de amortización del nuevo crédito
    INSERT INTO public.amortizaciones (
        credito_id, numero_cuota, fecha_vencimiento,
        monto_cuota, capital_cuota, interes_cuota, saldo_pendiente, estado
    )
    SELECT
        v_nuevo_credito_id,
        (cuota->>'numero')::INTEGER,
        (cuota->>'fecha_vencimiento')::DATE,
        (cuota->>'monto_cuota')::DECIMAL,
        (cuota->>'capital')::DECIMAL,
        (cuota->>'interes')::DECIMAL,
        (cuota->>'monto_cuota')::DECIMAL,
        'pendiente'
    FROM jsonb_array_elements(p_cuotas_json) AS cuota;

    -- 6. Actualizar contador de refinanciamientos del cliente
    UPDATE public.clientes
    SET total_refinanciamientos = COALESCE(total_refinanciamientos, 0) + 1,
        updated_at              = NOW()
    WHERE id = v_cliente_id;

    -- 7. Actualizar el saldo de la cartera
    UPDATE public.carteras
    SET saldo_actual = saldo_actual - v_delta_requerido,
        saldo_prestado = saldo_prestado + v_delta_requerido,
        updated_at   = NOW()
    WHERE id = p_cartera_id;

    RETURN jsonb_build_object(
        'success',        true,
        'old_credito_id', p_credito_id,
        'new_credito_id', v_nuevo_credito_id,
        'codigo',         v_codigo_credito
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refinanciar_credito TO authenticated;
