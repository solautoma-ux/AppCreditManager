-- Migration: 158_drop_motivo_cierre.sql
-- Description: Drops redundant 'motivo_cierre' column and updates functions.
-- Enforces 'estado' as the single source of truth.

-- 1. Update recalcular_saldos_cartera to rely ONLY on 'estado'
-- Also improves logic to strictly allow only Active/Vencido as "Carteara Activa"
CREATE OR REPLACE FUNCTION public.recalcular_saldos_cartera(p_cartera_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_cartera_activa DECIMAL;      -- Active loans (Capital pending)
    v_total_desembolsado DECIMAL;  -- All loans ever created
    v_total_recaudado DECIMAL;     -- All payments received
    v_total_perdido DECIMAL;       -- Capital lost to interrupted loans
    v_monto_inicial DECIMAL;
BEGIN
    -- 1. Get Initial Stats
    SELECT monto_inicial INTO v_monto_inicial
    FROM public.carteras
    WHERE id = p_cartera_id;

    -- 2. Calculate "Cartera Activa" (Sum of Capital of ACTIVE/OVERDUE credits)
    -- Must exclude Pagado, Interrumpido, Refinanciado
    SELECT COALESCE(SUM(monto_capital), 0)
    INTO v_cartera_activa
    FROM public.creditos
    WHERE cartera_id = p_cartera_id
    AND estado IN ('activo', 'vencido');

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

    -- 5. Calculate "Total Perdido" (Capital from interrupted loans NOT recovered)
    -- Relies on estado='interrumpido' instead of motivo_cierre
    SELECT COALESCE(SUM(c.monto_capital - COALESCE(paid.capital_pagado, 0)), 0)
    INTO v_total_perdido
    FROM public.creditos c
    LEFT JOIN (
        SELECT credito_id, SUM(monto_a_capital) as capital_pagado
        FROM public.pagos
        GROUP BY credito_id
    ) paid ON c.id = paid.credito_id
    WHERE c.cartera_id = p_cartera_id
    AND c.estado = 'interrumpido';

    -- 6. Update Cartera
    -- Saldo Prestado = Active Portfolio (Capital Sum)
    -- Saldo Actual = Initial - All Disbursed + All Collected
    UPDATE public.carteras
    SET 
        saldo_prestado = v_cartera_activa,
        saldo_actual = v_monto_inicial - v_total_desembolsado + v_total_recaudado,
        updated_at = NOW()
    WHERE id = p_cartera_id;

END;
$$;

-- 2. Update liquidar_credito_forzado to REMOVE motivo_cierre assignment
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
    SELECT id, codigo, saldo_capital_pendiente, saldo_interes_pendiente, cartera_id, estado
    INTO v_credito
    FROM public.creditos WHERE id = p_credito_id;
    
    IF v_credito.id IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Crédito no encontrado'); END IF;
    
    IF v_credito.estado IN ('interrumpido', 'pagado') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este crédito ya está cerrado');
    END IF;

    v_capital_pendiente := v_credito.saldo_capital_pendiente;
    v_interes_pendiente := v_credito.saldo_interes_pendiente;
    v_cartera_id := v_credito.cartera_id;

    -- Update Credit to 'interrumpido' ONLY (No motivo_cierre)
    UPDATE public.creditos SET 
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        estado = 'interrumpido',
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- Update Amortizations
    UPDATE public.amortizaciones SET 
        estado = 'liquidada', -- Keeping 'liquidada' for installments as per previous scripts
        saldo_pendiente = 0,
        updated_at = NOW()
    WHERE credito_id = p_credito_id AND estado != 'pagada';

    -- Update Cartera Balance
    UPDATE public.carteras SET 
        saldo_prestado = saldo_prestado - v_capital_pendiente,
        updated_at = NOW()
    WHERE id = v_cartera_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', format('Crédito "%s" interrumpido. Capital perdido: %s', v_credito.codigo, v_capital_pendiente),
        'resumen', jsonb_build_object('capital_perdido', v_capital_pendiente)
    );
END;
$$;

-- 3. DROP THE COLUMN
ALTER TABLE public.creditos DROP COLUMN IF EXISTS motivo_cierre;
