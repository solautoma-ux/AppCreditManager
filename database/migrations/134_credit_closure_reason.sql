-- MIGRATION: 134_credit_closure_reason.sql
-- Description: Adds 'motivo_cierre' to track why a credit was closed/liquidated.
-- Updates RPCs to populate this field ('pago_total' vs 'interrumpido').

-- 1. Add Column
ALTER TABLE public.creditos 
ADD COLUMN IF NOT EXISTS motivo_cierre VARCHAR(50); -- 'pago_total', 'interrumpido', 'anticipado'

-- 2. Update 'liquidar_credito_forzado' to set reason = 'interrumpido'
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

    -- 3. Return unpaid CAPITAL to Cartera
    UPDATE public.carteras SET 
        saldo_actual = saldo_actual + v_capital_pendiente,
        saldo_prestado = saldo_prestado - v_capital_pendiente,
        updated_at = NOW()
    WHERE id = v_cartera_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', format('Crédito "%s" interrumpido y liquidado. Capital devuelto.', v_credito.codigo),
        'resumen', jsonb_build_object(
            'capital_condonado', v_capital_pendiente,
            'interes_condonado', v_interes_pendiente
        )
    );
END;
$$;


-- 3. Update 'registrar_pago_completo' to set reason = 'pago_total' when finished
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

    -- Calculate
    v_nuevo_saldo_capital := v_credito.saldo_capital_pendiente - p_monto_a_capital;
    v_nuevo_saldo_interes := v_credito.saldo_interes_pendiente - p_monto_a_interes;

    -- Determine new status and reason
    IF (v_nuevo_saldo_capital + v_nuevo_saldo_interes) <= 0.00 THEN
        v_nuevo_estado := 'liquidado';
        v_motivo_cierre := 'pago_total';
    ELSE
        v_nuevo_estado := 'activo';
        v_motivo_cierre := NULL; -- Remains null if active
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
        motivo_cierre = COALESCE(v_motivo_cierre, motivo_cierre), -- Update only if closing
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- Cartera Update
    UPDATE public.carteras
    SET saldo_actual = saldo_actual + p_monto_total, updated_at = NOW()
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
