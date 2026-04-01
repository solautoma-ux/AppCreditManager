-- MIGRATION: 153_fix_amortization_sync.sql
-- Description: Fixes the registrar_pago_completo function to include waterfall sync
-- that marks amortizaciones as 'pagada' when fully paid.
-- This is required so that the Home screen doesn't show paid installments.

CREATE OR REPLACE FUNCTION public.registrar_pago_completo(
    p_credito_id UUID,
    p_monto_total DECIMAL,
    p_monto_a_capital DECIMAL,
    p_monto_a_interes DECIMAL,
    p_fecha_pago DATE,
    p_registrado_por UUID,
    p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito RECORD;
    v_pago_id UUID;
    v_nuevo_saldo_capital DECIMAL;
    v_nuevo_saldo_interes DECIMAL;
    v_nuevo_estado VARCHAR;
    v_cartera_id UUID;
    v_ganancia_neta DECIMAL;
    -- Waterfall variables
    v_monto_distribuir DECIMAL;
    v_amortizacion RECORD;
    v_monto_aplicar DECIMAL;
BEGIN
    -- 1. Get credit data
    SELECT id, cartera_id, saldo_capital_pendiente, saldo_interes_pendiente, monto_capital, estado
    INTO v_credito
    FROM public.creditos
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Crédito no encontrado'); END IF;
    IF v_credito.estado NOT IN ('activo', 'vencido') THEN RETURN jsonb_build_object('success', false, 'error', 'El crédito no está activo'); END IF;

    v_cartera_id := v_credito.cartera_id;

    -- 2. Calculate new balances
    v_nuevo_saldo_capital := GREATEST(0, v_credito.saldo_capital_pendiente - p_monto_a_capital);
    v_nuevo_saldo_interes := GREATEST(0, v_credito.saldo_interes_pendiente - p_monto_a_interes);

    -- 3. Determine new state
    IF v_nuevo_saldo_capital <= 0 AND v_nuevo_saldo_interes <= 0 THEN
        v_nuevo_estado := 'pagado';
    ELSE
        v_nuevo_estado := v_credito.estado; 
    END IF;

    -- 4. Register payment
    -- 4. Register payment
    INSERT INTO public.pagos (credito_id, monto_total, monto_a_capital, monto_a_interes, fecha_pago, registrado_por_id, notas)
    VALUES (p_credito_id, p_monto_total, p_monto_a_capital, p_monto_a_interes, p_fecha_pago, p_registrado_por, p_notas)
    RETURNING id INTO v_pago_id;

    -- 5. Update credit
    UPDATE public.creditos
    SET saldo_capital_pendiente = v_nuevo_saldo_capital,
        saldo_interes_pendiente = v_nuevo_saldo_interes,
        estado = v_nuevo_estado,
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 6. Update cartera balance
    v_ganancia_neta := p_monto_a_capital + p_monto_a_interes;
    
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + v_ganancia_neta,
        saldo_prestado = GREATEST(0, saldo_prestado - p_monto_a_capital),
        updated_at = NOW()
    WHERE id = v_cartera_id;

    -- 7. WATERFALL SYNC: Update Amortization Schedule rows
    -- This ensures installments are marked as 'pagada' and disappear from Home screen
    v_monto_distribuir := p_monto_total;
    
    FOR v_amortizacion IN 
        SELECT * FROM public.amortizaciones 
        WHERE credito_id = p_credito_id AND estado != 'pagada'
        ORDER BY numero_cuota ASC
    LOOP
        IF v_monto_distribuir <= 0 THEN
            EXIT;
        END IF;

        -- Apply payment to this installment (up to its pending balance)
        v_monto_aplicar := LEAST(v_monto_distribuir, v_amortizacion.saldo_pendiente);
        
        UPDATE public.amortizaciones
        SET 
            saldo_pendiente = saldo_pendiente - v_monto_aplicar,
            estado = CASE 
                WHEN (saldo_pendiente - v_monto_aplicar) <= 0.01 THEN 'pagada'
                ELSE 'parcial' 
            END,
            updated_at = NOW()
        WHERE id = v_amortizacion.id;

        v_monto_distribuir := v_monto_distribuir - v_monto_aplicar;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'pago_id', v_pago_id,
        'nuevo_estado', v_nuevo_estado,
        'saldo_capital', v_nuevo_saldo_capital,
        'saldo_interes', v_nuevo_saldo_interes
    );
END;
$$;

-- Also fix the already-paid installment for Luis Eduardo Pareja (today's date)
-- This updates any amortización that should be marked as 'pagada' but wasn't
UPDATE public.amortizaciones a
SET estado = 'pagada', updated_at = NOW()
WHERE a.saldo_pendiente <= 0.01 AND a.estado != 'pagada';
