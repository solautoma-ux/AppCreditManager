-- Migration to Update Amortization Rows Status on Payment
-- Previously, only the global Credit balance was updated. 
-- Now we distribute the payment across the 'amortizaciones' table rows.

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
    v_pago_id UUID;
    
    -- Variables for Loop
    v_monto_distribuir DECIMAL;
    v_amortizacion RECORD;
    v_monto_aplicar DECIMAL;
BEGIN
    -- 1. Get current credit info (locking)
    SELECT * INTO v_credito 
    FROM public.creditos 
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédito no encontrado';
    END IF;

    -- 2. Calculate global balances
    v_nuevo_saldo_capital := GREATEST(0.00, v_credito.saldo_capital_pendiente - p_monto_a_capital);
    v_nuevo_saldo_interes := GREATEST(0.00, v_credito.saldo_interes_pendiente - p_monto_a_interes);

    -- 3. Determine new status
    IF (v_nuevo_saldo_capital + v_nuevo_saldo_interes) <= 0.00 THEN
        v_nuevo_estado := 'liquidado';
    ELSE
        v_nuevo_estado := 'activo';
    END IF;

    -- 4. Insert Payment Record
    INSERT INTO public.pagos (
        credito_id, 
        registrado_por_id, 
        monto_total, 
        monto_a_capital, 
        monto_a_interes, 
        fecha_pago, 
        notas
    ) VALUES (
        p_credito_id,
        p_registrado_por_id,
        p_monto_total,
        p_monto_a_capital,
        p_monto_a_interes,
        p_fecha_pago,
        p_notas
    ) RETURNING id INTO v_pago_id;

    -- 5. Update Credit
    UPDATE public.creditos
    SET 
        saldo_capital_pendiente = v_nuevo_saldo_capital,
        saldo_interes_pendiente = v_nuevo_saldo_interes,
        estado = CASE WHEN estado = 'liquidado' THEN 'liquidado' ELSE v_nuevo_estado END,
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 6. Update Cartera Balance
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + p_monto_total,
        updated_at = NOW()
    WHERE id = v_credito.cartera_id;

    -- 7. DISTRIBUTE TO AMORTIZATIONS (New Logic)
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
                WHEN (saldo_pendiente - v_monto_aplicar) <= 0 THEN 'pagada' 
                ELSE 'parcial' 
            END,
            updated_at = NOW()
        WHERE id = v_amortizacion.id;

        v_monto_distribuir := v_monto_distribuir - v_monto_aplicar;
    END LOOP;

    -- 8. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'pago_id', v_pago_id,
        'nuevo_saldo_capital', v_nuevo_saldo_capital,
        'nuevo_saldo_interes', v_nuevo_saldo_interes,
        'nuevo_saldo_total', v_nuevo_saldo_capital + v_nuevo_saldo_interes,
        'nuevo_estado', v_nuevo_estado
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
