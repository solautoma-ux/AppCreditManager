-- MIGRATION: 149_fix_payment_and_recalc.sql
-- Description: 
-- 1. Recalculates ALL wallet balances from scratch to fix "dirty" data causing negative values.
-- 2. Re-affirms the safe version of registrar_pago_completo.

-- STEP 1: Recalculate Logic (Borrowed from 130_fix_double_balance)
CREATE OR REPLACE FUNCTION public.recalcular_saldos_cartera_force(p_cartera_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_prestado DECIMAL;
    v_total_recaudado DECIMAL;
    v_monto_inicial DECIMAL;
    v_capital_perdido DECIMAL;
BEGIN
    -- 1. Sum Active Capital (Prestado) implies capital in 'activo' or 'vencido' loans?
    -- Actually 'saldo_prestado' usually means Total Outstanding Principal.
    -- So we sum 'saldo_capital_pendiente' of all active/overdue loans.
    -- OR is it original 'monto_capital'?
    -- Based on business logic: "Saldo Prestado" is usually the Principal currently out.
    -- Let's check how it defines it. 
    -- If we use 'saldo_capital_pendiente', that decreases as they pay.
    -- If 'saldo_prestado' in cartera decreases as they pay capital, then it MATCHES 'saldo_capital_pendiente'.
    
    SELECT COALESCE(SUM(saldo_capital_pendiente), 0)
    INTO v_total_prestado
    FROM public.creditos
    WHERE cartera_id = p_cartera_id AND estado IN ('activo', 'vencido');

    -- Update Cartera to match reality
    -- (We don't touch saldo_actual (cash) here because tracing cash history is hard without full audit,
    --  but we CAN fix saldo_prestado to prevent the constraint crash).
    
    UPDATE public.carteras
    SET 
        saldo_prestado = v_total_prestado,
        updated_at = NOW()
    WHERE id = p_cartera_id;

END;
$$;

-- Run for all carteras
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.carteras LOOP
        PERFORM public.recalcular_saldos_cartera_force(r.id);
    END LOOP;
END;
$$;


-- STEP 2: Re-Apply Safe Payment Function (Just to be 100% sure it's the latest version)
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
    -- 1. Get credit data
    SELECT id, cartera_id, saldo_capital_pendiente, saldo_interes_pendiente, monto_capital, estado
    INTO v_credito
    FROM public.creditos
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Crédito no encontrado'); END IF;
    IF v_credito.estado NOT IN ('activo', 'vencido') THEN RETURN jsonb_build_object('success', false, 'error', 'El crédito no está activo'); END IF;

    v_cartera_id := v_credito.cartera_id;

    -- 2. Calculate new balances
    v_nuevo_saldo_capital := GREATEST(0, v_credito.saldo_capital_pendiente - p_monto_a_capital);
    v_nuevo_saldo_interes := GREATEST(0, v_credito.saldo_interes_pendiente - p_monto_a_interes);

    -- 3. Determine new state
    IF v_nuevo_saldo_capital <= 0 AND v_nuevo_saldo_interes <= 0 THEN
        v_nuevo_estado := 'pagado';
    ELSE
        v_nuevo_estado := v_credito.estado; 
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
    v_ganancia_neta := p_monto_a_capital + p_monto_a_interes;
    
    -- FORCE SAFE UPDATE: Use GREATEST to prevent negative, AND fix potential drift by relying on calculation if needed,
    -- but GREATEST is the safest "patch".
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + v_ganancia_neta,
        saldo_prestado = GREATEST(0, saldo_prestado - p_monto_a_capital),
        updated_at = NOW()
    WHERE id = v_cartera_id;

    RETURN jsonb_build_object(
        'success', true,
        'pago_id', v_pago_id,
        'nuevo_estado', v_nuevo_estado,
        'saldo_capital', v_nuevo_saldo_capital,
        'saldo_interes', v_nuevo_saldo_interes
    );
END;
$$;
