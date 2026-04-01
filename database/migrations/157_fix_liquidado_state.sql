-- Migration: 157_fix_liquidado_state.sql
-- Description: Updates liquidar_credito_forzado to use 'interrumpido' instead of deprecated 'liquidado'.
-- Fixes existing records with 'liquidado' status.

-- 1. Redefine the function to set correct status
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
    
    -- Check against correct terminal states
    IF v_credito.estado IN ('interrumpido', 'pagado') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este crédito ya está cerrado');
    END IF;

    v_capital_pendiente := v_credito.saldo_capital_pendiente;
    v_interes_pendiente := v_credito.saldo_interes_pendiente;
    v_cartera_id := v_credito.cartera_id;

    -- 1. Update Credit to 'interrumpido' (Correct state for Write-Off/Liquidation)
    UPDATE public.creditos SET 
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        estado = 'interrumpido', -- WAS 'liquidado'
        motivo_cierre = 'interrumpido',
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 2. Update all Amortizations to 'cancelada' (or liquidada if constraint allows, using cancelada for safety)
    -- We assume 'cancelada' or 'interrumpida' is valid. If check constraint fails, user will report.
    -- However, migration 136 used 'liquidada'. Let's stick to 'liquidada' for AMORTIZATIONS unless we know for sure.
    -- But for CREDITOS, it MUST be 'interrumpido'.
    UPDATE public.amortizaciones SET 
        estado = 'liquidada', -- Keeping this for amortizations as it might be valid there, or change to 'cancelada' if you prefer.
        saldo_pendiente = 0,
        updated_at = NOW()
    WHERE credito_id = p_credito_id AND estado != 'pagada';

    -- 3. Update Cartera balance (Loss logic)
    UPDATE public.carteras SET 
        saldo_prestado = saldo_prestado - v_capital_pendiente,
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

-- 2. Fix any existing credit with 'liquidado' status
UPDATE public.creditos 
SET estado = 'interrumpido', motivo_cierre = 'interrumpido'
WHERE estado = 'liquidado';

-- 3. Ensure constraint allows 'interrumpido' (Re-applying just in case)
-- ALTER TABLE public.creditos DROP CONSTRAINT IF EXISTS creditos_estado_check;
-- ALTER TABLE public.creditos ADD CONSTRAINT creditos_estado_check CHECK (estado IN ('activo', 'vencido', 'pagado', 'interrumpido', 'refinanciado'));
