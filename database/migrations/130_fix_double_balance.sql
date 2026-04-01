-- MIGRATION: 130_fix_double_balance.sql
-- Description: Fixes the issue where 'saldo_prestado' might be double-counted due to duplicate logic (RPC + Trigger).
-- 1. Drops potential conflicting triggers on 'creditos'.
-- 2. Recalculates 'saldo_prestado' and 'saldo_actual' for all carteras based on real data.

-- 1. DROP Potential Triggers (Safety Cleanup)
-- If there was a trigger named 'update_cartera_on_credit' or similar, we kill it.
DROP TRIGGER IF EXISTS update_cartera_saldo_insert ON public.creditos;
DROP TRIGGER IF EXISTS trg_actualizar_cartera_saldo ON public.creditos;
DROP TRIGGER IF EXISTS trigger_new_credito_update_cartera ON public.creditos;

-- 2. Function to Recalculate Logic
CREATE OR REPLACE FUNCTION public.recalcular_saldos_cartera(p_cartera_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_prestado DECIMAL;
    v_total_recaudado DECIMAL; -- (Opcional, si quisieramos validar saldo_actual por flujo)
    v_monto_inicial DECIMAL;
BEGIN
    -- Calcular el Total Capital Prestado REAL (sumando los créditos)
    SELECT COALESCE(SUM(monto_capital), 0)
    INTO v_total_prestado
    FROM public.creditos
    WHERE cartera_id = p_cartera_id;

    -- Obtener monto inicial
    SELECT monto_inicial INTO v_monto_inicial
    FROM public.carteras
    WHERE id = p_cartera_id;
    
    -- Calcular Saldo Actual (Teorico) = Inicial - Prestado + Recaudado(Capital+Interes en pagos)
    -- Recaudado total
    SELECT COALESCE(SUM(p.monto_total), 0)
    INTO v_total_recaudado
    FROM public.pagos p
    JOIN public.creditos c ON p.credito_id = c.id
    WHERE c.cartera_id = p_cartera_id;

    -- Update Cartera
    UPDATE public.carteras
    SET 
        saldo_prestado = v_total_prestado,
        saldo_actual = (v_monto_inicial - v_total_prestado) + v_total_recaudado,
        updated_at = NOW()
    WHERE id = p_cartera_id;

END;
$$;

-- 3. Run Recalculation for ALL Carteras
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.carteras LOOP
        PERFORM public.recalcular_saldos_cartera(r.id);
    END LOOP;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.recalcular_saldos_cartera TO authenticated;
