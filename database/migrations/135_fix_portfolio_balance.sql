-- MIGRATION: 135_fix_portfolio_balance.sql
-- Description: Fixes the Portfolio Balance (saldo_prestado) calculation.
-- Previously, saldo_prestado only increased on loan creation but didn't decrease on capital payments.
-- Now it correctly reflects the active portfolio (Capital Outstanding).

-- 1. Update registrar_pago_completo to decrease saldo_prestado on capital payment
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
    v_motivo_cierre VARCHAR;
    v_pago_id UUID;
BEGIN
    SELECT * INTO v_credito 
    FROM public.creditos 
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédito no encontrado';
    END IF;
    
    -- VALIDATION
    IF p_monto_a_interes > v_credito.saldo_interes_pendiente THEN
        RAISE EXCEPTION 'El abono a interés (%) supera el saldo pendiente (%)', p_monto_a_interes, v_credito.saldo_interes_pendiente;
    END IF;
    IF p_monto_a_capital > v_credito.saldo_capital_pendiente THEN
        RAISE EXCEPTION 'El abono a capital (%) supera el saldo pendiente (%)', p_monto_a_capital, v_credito.saldo_capital_pendiente;
    END IF;

    -- Calculate new balances
    v_nuevo_saldo_capital := v_credito.saldo_capital_pendiente - p_monto_a_capital;
    v_nuevo_saldo_interes := v_credito.saldo_interes_pendiente - p_monto_a_interes;

    -- Determine new status and reason
    IF (v_nuevo_saldo_capital + v_nuevo_saldo_interes) <= 0.00 THEN
        v_nuevo_estado := 'liquidado';
        v_motivo_cierre := 'pago_total';
    ELSE
        v_nuevo_estado := 'activo';
        v_motivo_cierre := NULL;
    END IF;

    -- Insert Payment
    INSERT INTO public.pagos (
        credito_id, registrado_por_id, monto_total, monto_a_capital, monto_a_interes, fecha_pago, notas
    ) VALUES (
        p_credito_id, p_registrado_por_id, p_monto_total, p_monto_a_capital, p_monto_a_interes, p_fecha_pago, p_notas
    ) RETURNING id INTO v_pago_id;

    -- Update Credit
    UPDATE public.creditos
    SET 
        saldo_capital_pendiente = v_nuevo_saldo_capital,
        saldo_interes_pendiente = v_nuevo_saldo_interes,
        estado = CASE WHEN estado = 'liquidado' THEN 'liquidado' ELSE v_nuevo_estado END,
        motivo_cierre = COALESCE(v_motivo_cierre, motivo_cierre),
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- Update Cartera Balance (FIXED: Now also decreases saldo_prestado on capital payment)
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + p_monto_total,
        saldo_prestado = saldo_prestado - p_monto_a_capital, -- <-- NEW: Reduce portfolio balance
        updated_at = NOW()
    WHERE id = v_credito.cartera_id;

    RETURN jsonb_build_object(
        'success', true,
        'pago_id', v_pago_id,
        'nuevo_saldo_total', v_nuevo_saldo_capital + v_nuevo_saldo_interes,
        'nuevo_estado', v_nuevo_estado
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;


-- 2. Recalculate all existing portfolio balances
-- This uses the existing recalcular_saldos_cartera function from migration 132
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.carteras LOOP
        PERFORM public.recalcular_saldos_cartera(r.id);
    END LOOP;
END;
$$;
