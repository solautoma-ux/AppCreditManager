-- MIGRATION: 132_fix_kpis.sql
-- Description: Updates the recalculation logic to match User Expectations.
-- 'Saldo Prestado' will now reflect "Cartera Activa" (Principal of Active Credits only).
-- 'Saldo Actual' (Available) remains based on cash flow (Initial - All Out + All In).

CREATE OR REPLACE FUNCTION public.recalcular_saldos_cartera(p_cartera_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_cartera_activa DECIMAL;      -- To show in "Total Prestado" (KPI)
    v_total_desembolsado DECIMAL;  -- To calculate Cash Flow
    v_total_recaudado DECIMAL;     -- To calculate Cash Flow
    v_monto_inicial DECIMAL;
BEGIN
    -- 1. Get Initial Stats
    SELECT monto_inicial INTO v_monto_inicial
    FROM public.carteras
    WHERE id = p_cartera_id;

    -- 2. Calculate "Cartera Activa" (Sum of Capital of NON-LIQUIDATED credits)
    -- This answers: "How much money is currently in the street?"
    SELECT COALESCE(SUM(monto_capital), 0)
    INTO v_cartera_activa
    FROM public.creditos
    WHERE cartera_id = p_cartera_id
    AND estado != 'liquidado';

    -- 3. Calculate "Total Desembolsado" (Historical Outflow)
    -- Needed for Cash Balance: We deducted this from initial.
    SELECT COALESCE(SUM(monto_capital), 0)
    INTO v_total_desembolsado
    FROM public.creditos
    WHERE cartera_id = p_cartera_id;

    -- 4. Calculate "Total Recaudado" (Historical Inflow)
    -- Needed for Cash Balance: We add this back.
    SELECT COALESCE(SUM(p.monto_total), 0)
    INTO v_total_recaudado
    FROM public.pagos p
    JOIN public.creditos c ON p.credito_id = c.id
    WHERE c.cartera_id = p_cartera_id;

    -- 5. Update Cartera
    -- Saldo Prestado = Active Portfolio
    -- Saldo Actual = Initial - All Out + All In
    UPDATE public.carteras
    SET 
        saldo_prestado = v_cartera_activa,
        saldo_actual = (v_monto_inicial - v_total_desembolsado) + v_total_recaudado,
        updated_at = NOW()
    WHERE id = p_cartera_id;

END;
$$;

-- Run Recalculation
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.carteras LOOP
        PERFORM public.recalcular_saldos_cartera(r.id);
    END LOOP;
END;
$$;
