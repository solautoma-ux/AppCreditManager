-- MIGRATION: 133_strict_payment_validation.sql
-- Description: Updates 'registrar_pago_completo' to strictly validate payment amounts.
-- Prevents paying more Capital or Interest than the actual debt.

CREATE OR REPLACE FUNCTION registrar_pago_completo(
    p_credito_id UUID,
    p_registrado_por_id UUID,
    p_monto_total DECIMAL,
    p_monto_a_capital DECIMAL,
    p_monto_a_interes DECIMAL,
    p_fecha_pago DATE,
    p_notas TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito RECORD;
    v_nuevo_saldo_capital DECIMAL;
    v_nuevo_saldo_interes DECIMAL;
    v_nuevo_estado VARCHAR;
    v_pago_id UUID;
BEGIN
    -- 1. Get current credit info (locking the row for update)
    SELECT * INTO v_credito 
    FROM public.creditos 
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédito no encontrado';
    END IF;

    -- 2. STRICT VALIDATION: Check if payment exceeds debt
    -- Allow a small epsilon for floating point issues? No, DECIMAL(15,2) is exact.
    
    IF p_monto_a_interes > v_credito.saldo_interes_pendiente THEN
        RAISE EXCEPTION 'El abono a interés (%) supera el saldo pendiente (%)', p_monto_a_interes, v_credito.saldo_interes_pendiente;
    END IF;

    IF p_monto_a_capital > v_credito.saldo_capital_pendiente THEN
        RAISE EXCEPTION 'El abono a capital (%) supera el saldo pendiente (%)', p_monto_a_capital, v_credito.saldo_capital_pendiente;
    END IF;

    -- 3. Calculate new balances
    v_nuevo_saldo_capital := v_credito.saldo_capital_pendiente - p_monto_a_capital;
    v_nuevo_saldo_interes := v_credito.saldo_interes_pendiente - p_monto_a_interes;

    -- 4. Determine new status
    IF (v_nuevo_saldo_capital + v_nuevo_saldo_interes) <= 0.00 THEN
        v_nuevo_estado := 'liquidado';
    ELSE
        v_nuevo_estado := 'activo';
    END IF;

    -- 5. Insert Payment Record
    INSERT INTO public.pagos (
        credito_id, 
        registrado_por_id, 
        monto_total, 
        monto_a_capital, 
        monto_a_interes, 
        fecha_pago, 
        notas
    ) VALUES (
        p_credito_id,
        p_registrado_por_id,
        p_monto_total,
        p_monto_a_capital,
        p_monto_a_interes,
        p_fecha_pago,
        p_notas
    ) RETURNING id INTO v_pago_id;

    -- 6. Update Credit
    UPDATE public.creditos
    SET 
        saldo_capital_pendiente = v_nuevo_saldo_capital,
        saldo_interes_pendiente = v_nuevo_saldo_interes,
        estado = CASE WHEN estado = 'liquidado' THEN 'liquidado' ELSE v_nuevo_estado END,
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 7. Update Cartera Balance
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + p_monto_total,
        updated_at = NOW()
    WHERE id = v_credito.cartera_id;

    -- 8. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'pago_id', v_pago_id,
        'nuevo_saldo_capital', v_nuevo_saldo_capital,
        'nuevo_saldo_interes', v_nuevo_saldo_interes,
        'nuevo_saldo_total', v_nuevo_saldo_capital + v_nuevo_saldo_interes,
        'nuevo_estado', v_nuevo_estado
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
