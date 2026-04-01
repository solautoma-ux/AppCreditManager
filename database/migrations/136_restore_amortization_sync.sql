-- MIGRATION: 136_restore_amortization_sync.sql
-- Description: Restores the 'waterfall' logic to update the amortization schedule when a payment is registered.
-- This ensures that installments are marked as 'pagada' and disappear from the Home screen.
-- Maintains strict validation and portfolio balance (saldo_prestado) fixes from previous migrations.

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
    -- Variables for Waterfall Loop
    v_monto_distribuir DECIMAL;
    v_amortizacion RECORD;
    v_monto_aplicar DECIMAL;
BEGIN
    -- 1. Get current credit info (locking for update)
    SELECT * INTO v_credito 
    FROM public.creditos 
    WHERE id = p_credito_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédito no encontrado';
    END IF;
    
    -- 2. STRICT VALIDATION: Check if payment exceeds remaining debt
    IF p_monto_a_interes > v_credito.saldo_interes_pendiente THEN
        RAISE EXCEPTION 'El abono a interés (%) supera el saldo pendiente (%)', p_monto_a_interes, v_credito.saldo_interes_pendiente;
    END IF;
    IF p_monto_a_capital > v_credito.saldo_capital_pendiente THEN
        RAISE EXCEPTION 'El abono a capital (%) supera el saldo pendiente (%)', p_monto_a_capital, v_credito.saldo_capital_pendiente;
    END IF;

    -- 3. Calculate new global balances
    v_nuevo_saldo_capital := v_credito.saldo_capital_pendiente - p_monto_a_capital;
    v_nuevo_saldo_interes := v_credito.saldo_interes_pendiente - p_monto_a_interes;

    -- 4. Determine new global status and reason
    IF (v_nuevo_saldo_capital + v_nuevo_saldo_interes) <= 0.00 THEN
        v_nuevo_estado := 'liquidado';
        v_motivo_cierre := 'pago_total';
    ELSE
        v_nuevo_estado := 'activo';
        v_motivo_cierre := NULL;
    END IF;

    -- 5. Insert Payment Record
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

    -- 6. Update Credit Global State
    UPDATE public.creditos
    SET 
        saldo_capital_pendiente = v_nuevo_saldo_capital,
        saldo_interes_pendiente = v_nuevo_saldo_interes,
        estado = CASE WHEN estado = 'liquidado' THEN 'liquidado' ELSE v_nuevo_estado END,
        motivo_cierre = COALESCE(v_motivo_cierre, motivo_cierre),
        updated_at = NOW()
    WHERE id = p_credito_id;

    -- 7. Update Cartera Balance (Including saldo_prestado reduction)
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual + p_monto_total,
        saldo_prestado = saldo_prestado - p_monto_a_capital,
        updated_at = NOW()
    WHERE id = v_credito.cartera_id;

    -- 8. WATERFALL SYNC: Update Amortization Schedule rows
    -- This is the missing piece that ensures rows disappear from Home screen
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
                WHEN (saldo_pendiente - v_monto_aplicar) <= 0.01 THEN 'pagada' -- Threshold for rounding
                ELSE 'parcial' 
            END,
            updated_at = NOW()
        WHERE id = v_amortizacion.id;

        v_monto_distribuir := v_monto_distribuir - v_monto_aplicar;
    END LOOP;

    -- 9. Final JSON response
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
