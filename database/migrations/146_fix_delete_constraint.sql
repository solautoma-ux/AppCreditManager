-- MIGRATION: 146_fix_delete_constraint.sql
-- Description: Updates eliminar_credito_seguro to prevent negative saldo_prestado

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
    -- USE GREATEST(0, ...) to avoid check constraint violation if data is out of sync
    UPDATE public.carteras SET 
        saldo_actual = saldo_actual + v_monto_capital,
        saldo_prestado = GREATEST(0, saldo_prestado - v_monto_capital),
        updated_at = NOW()
    WHERE id = v_cartera_id;

    -- Delete amortizations first (FK cascade should handle this, but explicit is safer)
    DELETE FROM public.amortizaciones WHERE credito_id = p_credito_id;
    
    -- Delete the credit
    DELETE FROM public.creditos WHERE id = p_credito_id;
    
    RETURN jsonb_build_object('success', true, 'message', format('Crédito "%s" eliminado correctamente. El capital ha sido devuelto a la cartera.', v_credito_codigo));
END;
$$;
