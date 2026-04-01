-- MIGRATION: 124_admin_safety_actions.sql
-- Description: SQL functions for safe deletion and liquidation of wallets/credits
-- These functions enforce business rules before destructive operations.

-- ============================================================
-- 1. SAFE DELETE CARTERA (Wallet)
-- ============================================================
-- Only allows deletion if there are NO associated credits.
-- Returns: { success: boolean, message: string }

CREATE OR REPLACE FUNCTION public.eliminar_cartera_seguro(p_cartera_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count_creditos INT;
    v_cartera_nombre VARCHAR;
BEGIN
    -- Get cartera name for error message
    SELECT nombre INTO v_cartera_nombre FROM public.carteras WHERE id = p_cartera_id;
    
    IF v_cartera_nombre IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cartera no encontrada');
    END IF;

    -- Count associated credits
    SELECT COUNT(*) INTO v_count_creditos FROM public.creditos WHERE cartera_id = p_cartera_id;
    
    IF v_count_creditos > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('No se puede eliminar la cartera "%s" porque tiene %s crédito(s) asociado(s). Elimine o transfiera los créditos primero.', v_cartera_nombre, v_count_creditos)
        );
    END IF;

    -- Safe to delete
    DELETE FROM public.carteras WHERE id = p_cartera_id;
    
    RETURN jsonb_build_object('success', true, 'message', format('Cartera "%s" eliminada correctamente.', v_cartera_nombre));
END;
$$;

-- ============================================================
-- 2. SAFE DELETE CREDITO (Credit)
-- ============================================================
-- Only allows deletion if there are NO associated payments.
-- Returns: { success: boolean, message: string }

CREATE OR REPLACE FUNCTION public.eliminar_credito_seguro(p_credito_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count_pagos INT;
    v_credito_codigo VARCHAR;
    v_monto_capital NUMERIC;
    v_cartera_id UUID;
BEGIN
    -- Get credit info
    SELECT codigo, monto_capital, cartera_id 
    INTO v_credito_codigo, v_monto_capital, v_cartera_id 
    FROM public.creditos WHERE id = p_credito_id;
    
    IF v_credito_codigo IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Crédito no encontrado');
    END IF;

    -- Count associated payments
    SELECT COUNT(*) INTO v_count_pagos FROM public.pagos WHERE credito_id = p_credito_id;
    
    IF v_count_pagos > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('No se puede eliminar el crédito "%s" porque tiene %s pago(s) registrado(s). Use la opción "Liquidar" si desea cerrar este crédito.', v_credito_codigo, v_count_pagos)
        );
    END IF;

    -- Return capital to cartera (since no payments were made)
    UPDATE public.carteras SET 
        saldo_actual = saldo_actual + v_monto_capital,
        saldo_prestado = saldo_prestado - v_monto_capital,
        updated_at = NOW()
    WHERE id = v_cartera_id;

    -- Delete amortizations first (FK cascade should handle this, but explicit is safer)
    DELETE FROM public.amortizaciones WHERE credito_id = p_credito_id;
    
    -- Delete the credit
    DELETE FROM public.creditos WHERE id = p_credito_id;
    
    RETURN jsonb_build_object('success', true, 'message', format('Crédito "%s" eliminado correctamente. El capital ha sido devuelto a la cartera.', v_credito_codigo));
END;
$$;

-- ============================================================
-- 3. LIQUIDAR CREDITO (Force Close / Write Off)
-- ============================================================
-- Resets all balances to 0 as if the debt was fully paid/forgiven.
-- - Credit: saldo_capital=0, saldo_interes=0, estado='liquidado'
-- - Amortizations: estado='liquidada', saldo_pendiente=0
-- - Cartera: Returns unpaid capital to saldo_actual
-- - Payments: NOT deleted (audit trail)
-- Returns: { success: boolean, message: string, resumen: object }

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

    -- 1. Update Credit to Liquidated state
    UPDATE public.creditos SET 
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        estado = 'liquidado',
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 2. Update all Amortizations to 'liquidada'
    UPDATE public.amortizaciones SET 
        estado = 'liquidada',
        saldo_pendiente = 0,
        updated_at = NOW()
    WHERE credito_id = p_credito_id AND estado != 'pagada';

    -- 3. Return unpaid CAPITAL to Cartera (NOT interest, that's lost revenue)
    UPDATE public.carteras SET 
        saldo_actual = saldo_actual + v_capital_pendiente,
        saldo_prestado = saldo_prestado - v_capital_pendiente,
        updated_at = NOW()
    WHERE id = v_cartera_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', format('Crédito "%s" liquidado (forzado). Capital devuelto a cartera.', v_credito.codigo),
        'resumen', jsonb_build_object(
            'capital_condonado', v_capital_pendiente,
            'interes_condonado', v_interes_pendiente,
            'total_condonado', v_capital_pendiente + v_interes_pendiente
        )
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.eliminar_cartera_seguro TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_credito_seguro TO authenticated;
GRANT EXECUTE ON FUNCTION public.liquidar_credito_forzado TO authenticated;
