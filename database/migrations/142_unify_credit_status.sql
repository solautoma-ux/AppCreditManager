-- MIGRATION: 142_unify_credit_status.sql
-- Description: Unifies credit status by eliminating dependency on motivo_cierre.
-- New states: 'activo', 'vencido', 'pagado', 'interrumpido', 'refinanciado'

-- 1. First DROP the old constraint (to allow migration)
ALTER TABLE public.creditos 
DROP CONSTRAINT IF EXISTS creditos_estado_check;

-- 2. Migrate existing data: Convert liquidado + motivo_cierre to unified state
UPDATE public.creditos
SET estado = CASE 
    WHEN motivo_cierre = 'pago_total' THEN 'pagado'
    WHEN motivo_cierre = 'interrumpido' THEN 'interrumpido'
    WHEN motivo_cierre = 'refinanciado' THEN 'refinanciado'
    ELSE 'pagado' -- Default fallback for any liquidado without motivo
END
WHERE estado = 'liquidado';

-- 3. NOW add the new constraint (after data is migrated)
ALTER TABLE public.creditos 
ADD CONSTRAINT creditos_estado_check 
CHECK (estado IN ('activo', 'vencido', 'pagado', 'interrumpido', 'refinanciado'));

-- 3. Update registrar_pago_completo function to use 'pagado' instead of 'liquidado'
CREATE OR REPLACE FUNCTION public.registrar_pago_completo(
    p_credito_id UUID,
    p_monto_total DECIMAL,
    p_monto_a_capital DECIMAL,
    p_monto_a_interes DECIMAL,
    p_fecha_pago DATE,
    p_registrado_por UUID,
    p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito RECORD;
    v_pago_id UUID;
    v_nuevo_saldo_capital DECIMAL;
    v_nuevo_saldo_interes DECIMAL;
    v_nuevo_estado VARCHAR;
    v_cartera_id UUID;
    v_ganancia_neta DECIMAL;
BEGIN
    -- 1. Get credit data with lock
    SELECT id, cartera_id, saldo_capital_pendiente, saldo_interes_pendiente, monto_capital, estado
    INTO v_credito
    FROM public.creditos
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito no encontrado');
    END IF;

    IF v_credito.estado NOT IN ('activo', 'vencido') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El crédito no está activo');
    END IF;

    v_cartera_id := v_credito.cartera_id;

    -- 2. Calculate new balances
    v_nuevo_saldo_capital := GREATEST(0, v_credito.saldo_capital_pendiente - p_monto_a_capital);
    v_nuevo_saldo_interes := GREATEST(0, v_credito.saldo_interes_pendiente - p_monto_a_interes);

    -- 3. Determine new state (using 'pagado' instead of 'liquidado')
    IF v_nuevo_saldo_capital <= 0 AND v_nuevo_saldo_interes <= 0 THEN
        v_nuevo_estado := 'pagado';
    ELSE
        v_nuevo_estado := v_credito.estado; -- Keep current state (activo or vencido)
    END IF;

    -- 4. Register payment
    INSERT INTO public.pagos (credito_id, monto_total, monto_a_capital, monto_a_interes, fecha_pago, registrado_por, notas)
    VALUES (p_credito_id, p_monto_total, p_monto_a_capital, p_monto_a_interes, p_fecha_pago, p_registrado_por, p_notas)
    RETURNING id INTO v_pago_id;

    -- 5. Update credit
    UPDATE public.creditos
    SET saldo_capital_pendiente = v_nuevo_saldo_capital,
        saldo_interes_pendiente = v_nuevo_saldo_interes,
        estado = v_nuevo_estado,
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 6. Update cartera balance (capital returns + interest earned)
    v_ganancia_neta := p_monto_a_capital + p_monto_a_interes;
    UPDATE public.carteras
    SET saldo_actual = saldo_actual + v_ganancia_neta,
        updated_at = NOW()
    WHERE id = v_cartera_id;

    -- 7. Return result
    RETURN jsonb_build_object(
        'success', true,
        'pago_id', v_pago_id,
        'nuevo_estado', v_nuevo_estado,
        'saldo_capital', v_nuevo_saldo_capital,
        'saldo_interes', v_nuevo_saldo_interes
    );
END;
$$;

-- 4. Update forzar_liquidacion function to use 'interrumpido' directly
CREATE OR REPLACE FUNCTION public.forzar_liquidacion(
    p_credito_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito RECORD;
    v_capital_perdido DECIMAL;
BEGIN
    -- Get credit with lock
    SELECT id, cartera_id, saldo_capital_pendiente, monto_capital, estado
    INTO v_credito
    FROM public.creditos
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Crédito no encontrado');
    END IF;

    IF v_credito.estado NOT IN ('activo', 'vencido') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El crédito ya está cerrado');
    END IF;

    v_capital_perdido := v_credito.saldo_capital_pendiente;

    -- Close credit as 'interrumpido' (directly in estado, no motivo_cierre needed)
    UPDATE public.creditos
    SET estado = 'interrumpido',
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- Update cartera: register capital loss
    UPDATE public.carteras
    SET capital_perdido = COALESCE(capital_perdido, 0) + v_capital_perdido,
        updated_at = NOW()
    WHERE id = v_credito.cartera_id;

    RETURN jsonb_build_object(
        'success', true,
        'capital_perdido', v_capital_perdido,
        'message', 'Crédito interrumpido. Capital perdido registrado.'
    );
END;
$$;

-- 5. Update refinanciar_credito to use 'refinanciado' directly
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
    v_nuevo_credito_id UUID;
    v_old_saldo_capital DECIMAL;
    v_codigo_credito VARCHAR;
    v_cliente_id UUID;
BEGIN
    -- 1. Get old credit data
    SELECT saldo_capital_pendiente, cliente_id
    INTO v_old_saldo_capital, v_cliente_id
    FROM public.creditos
    WHERE id = p_credito_id AND admin_id = p_admin_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédito no encontrado o no pertenece al admin';
    END IF;

    -- 2. Close old credit as 'refinanciado'
    UPDATE public.creditos
    SET estado = 'refinanciado',
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 3. Generate new credit code
    v_codigo_credito := 'CR-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0') || '-' || TO_CHAR(NOW(), 'MMDD');

    -- 4. Create new credit (including creado_por_id and fecha_proximo_pago)
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

    -- 5. Create amortization schedule (using correct column names)
    INSERT INTO public.amortizaciones (credito_id, numero_cuota, fecha_vencimiento, monto_cuota, capital_cuota, interes_cuota, saldo_pendiente, estado)
    SELECT 
        v_nuevo_credito_id,
        (cuota->>'numero')::INTEGER,
        (cuota->>'fecha_vencimiento')::DATE,
        (cuota->>'monto_cuota')::DECIMAL,
        (cuota->>'capital')::DECIMAL,
        (cuota->>'interes')::DECIMAL,
        (cuota->>'monto_cuota')::DECIMAL,  -- saldo_pendiente starts as full quota
        'pendiente'
    FROM jsonb_array_elements(p_cuotas_json) AS cuota;

    -- 6. Update client refinancing count
    UPDATE public.clientes
    SET total_refinanciamientos = COALESCE(total_refinanciamientos, 0) + 1,
        updated_at = NOW()
    WHERE id = v_cliente_id;

    -- 7. Update cartera: return old balance, deduct new capital
    UPDATE public.carteras
    SET saldo_actual = saldo_actual + v_old_saldo_capital - p_monto_capital,
        updated_at = NOW()
    WHERE id = p_cartera_id;

    RETURN jsonb_build_object(
        'success', true,
        'old_credito_id', p_credito_id,
        'new_credito_id', v_nuevo_credito_id,
        'codigo', v_codigo_credito
    );
END;
$$;
