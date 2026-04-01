-- MIGRATION: 136_fix_liquidation_loss.sql
-- Description: Fixes the "Liquidar" (interrupt) logic.
-- Business Rule: When a loan is forcefully liquidated, the unpaid capital is LOST (write-off).
-- The wallet balance should NOT increase - instead it stays as-is (money was already gone when loan was created).

-- 1. Fix the liquidar_credito_forzado function
CREATE OR REPLACE FUNCTION public.liquidar_credito_forzado(p_credito_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito RECORD;
    v_capital_pendiente NUMERIC;
    v_interes_pendiente NUMERIC;
    v_cartera_id UUID;
BEGIN
    -- Get credit info
    SELECT id, codigo, saldo_capital_pendiente, saldo_interes_pendiente, cartera_id, estado
    INTO v_credito
    FROM public.creditos WHERE id = p_credito_id;
    
    IF v_credito.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Crédito no encontrado');
    END IF;
    
    IF v_credito.estado = 'liquidado' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este crédito ya está liquidado');
    END IF;

    v_capital_pendiente := v_credito.saldo_capital_pendiente;
    v_interes_pendiente := v_credito.saldo_interes_pendiente;
    v_cartera_id := v_credito.cartera_id;

    -- 1. Update Credit to Liquidated state with reason 'interrumpido'
    UPDATE public.creditos SET 
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        estado = 'liquidado',
        motivo_cierre = 'interrumpido',
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 2. Update all Amortizations to 'liquidada'
    UPDATE public.amortizaciones SET 
        estado = 'liquidada',
        saldo_pendiente = 0,
        updated_at = NOW()
    WHERE credito_id = p_credito_id AND estado != 'pagada';

    -- 3. Update Cartera: Remove from "prestado" but DO NOT add to "disponible"
    -- The capital is LOST (write-off), so we don't return it to saldo_actual.
    -- We only remove it from saldo_prestado because it's no longer an active loan.
    UPDATE public.carteras SET 
        saldo_prestado = saldo_prestado - v_capital_pendiente, -- Remove from active portfolio
        -- saldo_actual is NOT increased - the money is lost
        updated_at = NOW()
    WHERE id = v_cartera_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', format('Crédito "%s" interrumpido. Capital perdido: %s', v_credito.codigo, v_capital_pendiente),
        'resumen', jsonb_build_object(
            'capital_perdido', v_capital_pendiente,
            'interes_no_cobrado', v_interes_pendiente
        )
    );
END;
$$;

-- 2. Update the recalculation function to properly handle losses
-- saldo_actual = monto_inicial - total_desembolsado_historico + total_recaudado - perdidas_interrumpidas
CREATE OR REPLACE FUNCTION public.recalcular_saldos_cartera(p_cartera_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_cartera_activa DECIMAL;      -- Active loans only (not liquidated)
    v_total_desembolsado DECIMAL;  -- All loans ever created (historical)
    v_total_recaudado DECIMAL;     -- All payments received
    v_total_perdido DECIMAL;       -- Capital lost to interrupted loans
    v_monto_inicial DECIMAL;
BEGIN
    -- 1. Get Initial Stats
    SELECT monto_inicial INTO v_monto_inicial
    FROM public.carteras
    WHERE id = p_cartera_id;

    -- 2. Calculate "Cartera Activa" (Sum of Capital of NON-LIQUIDATED credits)
    SELECT COALESCE(SUM(monto_capital), 0)
    INTO v_cartera_activa
    FROM public.creditos
    WHERE cartera_id = p_cartera_id
    AND estado != 'liquidado';

    -- 3. Calculate "Total Desembolsado" (All loans ever created)
    SELECT COALESCE(SUM(monto_capital), 0)
    INTO v_total_desembolsado
    FROM public.creditos
    WHERE cartera_id = p_cartera_id;

    -- 4. Calculate "Total Recaudado" (All payments received)
    SELECT COALESCE(SUM(p.monto_total), 0)
    INTO v_total_recaudado
    FROM public.pagos p
    JOIN public.creditos c ON p.credito_id = c.id
    WHERE c.cartera_id = p_cartera_id;

    -- 5. Calculate "Total Perdido" (Capital from interrupted loans that was NOT recovered)
    -- This is monto_capital - what was actually paid back in capital
    SELECT COALESCE(SUM(c.monto_capital - COALESCE(paid.capital_pagado, 0)), 0)
    INTO v_total_perdido
    FROM public.creditos c
    LEFT JOIN (
        SELECT credito_id, SUM(monto_a_capital) as capital_pagado
        FROM public.pagos
        GROUP BY credito_id
    ) paid ON c.id = paid.credito_id
    WHERE c.cartera_id = p_cartera_id
    AND c.motivo_cierre = 'interrumpido';

    -- 6. Update Cartera
    -- Saldo Prestado = Active Portfolio only
    -- Saldo Actual = Initial - All Disbursed + All Collected - Losses from interruptions
    UPDATE public.carteras
    SET 
        saldo_prestado = v_cartera_activa,
        saldo_actual = v_monto_inicial - v_total_desembolsado + v_total_recaudado,
        -- Note: v_total_perdido is already accounted for when loans were interrupted
        -- because we didn't return the capital. So no need to subtract again.
        updated_at = NOW()
    WHERE id = p_cartera_id;

END;
$$;

-- 3. Recalculate all existing wallet balances
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.carteras LOOP
        PERFORM public.recalcular_saldos_cartera(r.id);
    END LOOP;
END;
$$;

-- 4. Fix existing loans without motivo_cierre
-- If liquidated with no payments or partial payments < monto_total, mark as 'interrumpido'
-- If liquidated with full payments, mark as 'pago_total'
UPDATE public.creditos c
SET motivo_cierre = CASE
    WHEN (
        SELECT COALESCE(SUM(p.monto_total), 0) 
        FROM public.pagos p 
        WHERE p.credito_id = c.id
    ) >= c.monto_total THEN 'pago_total'
    ELSE 'interrumpido'
END
WHERE c.estado = 'liquidado' AND c.motivo_cierre IS NULL;
