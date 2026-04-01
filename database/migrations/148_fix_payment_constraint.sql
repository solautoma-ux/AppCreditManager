-- MIGRATION: 148_fix_payment_constraint.sql
-- Description: Updates registrar_pago_completo to prevent negative saldo_prestado

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

    -- 6. Update cartera balance
    -- CRITICAL FIX: Ensure saldo_prestado doesn't go negative
    v_ganancia_neta := p_monto_a_capital + p_monto_a_interes;
    
    -- We assume the payment returns capital to wallet (saldo_actual increases)
    -- AND we must reduce the 'saldo_prestado' because that money is no longer lent out.
    -- But we only reduce by the CAPITAL portion of the payment, not interest.
    -- Wait, looking at logic: 
    -- "saldo_actual = saldo_actual + v_ganancia_neta" -> Correct, cash increases by total payment.
    -- But "saldo_prestado" correction was missing in previous migration 142!
    -- 142 only updated saldo_actual.
    -- It seems saldo_prestado wasn't being reduced on payments? 
    -- Or maybe it was handled elsewhere?
    -- Let's check 135_fix_portfolio_balance or others.
    -- Actually 142 line 90 only updates `saldo_actual`.
    -- If `saldo_prestado` isn't reduced on payments, it never goes down until loan is closed?
    -- That would be wrong. It should go down as capital is repaid.
    
    -- Let's Add saldo_prestado reduction here.
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + v_ganancia_neta,
        saldo_prestado = GREATEST(0, saldo_prestado - p_monto_a_capital), -- Reduce loaned amount by capital repaid
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
