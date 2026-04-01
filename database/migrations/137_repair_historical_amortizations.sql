-- MIGRATION: 137_repair_historical_amortizations.sql
-- Description: Repairs historical data where payments were registered but the amortization schedule wasn't updated.
-- It iterates through all credits, resets their amortizations, and re-applies the total paid amount.

CREATE OR REPLACE FUNCTION public.reparar_sincronizacion_amortizaciones()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito RECORD;
    v_total_pagado DECIMAL;
    v_monto_distribuir DECIMAL;
    v_amortizacion RECORD;
    v_monto_aplicar DECIMAL;
    v_count_reparados INT := 0;
BEGIN
    -- 1. Iterate through all credits that have at least one payment
    FOR v_credito IN SELECT id FROM public.creditos LOOP
        
        -- Get total successfully registered payments for this credit
        SELECT COALESCE(SUM(monto_total), 0) INTO v_total_pagado 
        FROM public.pagos 
        WHERE credito_id = v_credito.id;

        -- 2. Reset ALL amortizations for this credit to original unpaid state
        -- (Assuming monto_cuota is the original required amount)
        UPDATE public.amortizaciones 
        SET 
            saldo_pendiente = monto_cuota,
            estado = 'pendiente',
            updated_at = NOW()
        WHERE credito_id = v_credito.id;

        -- 3. Re-apply the total paid amount in waterfall fashion
        v_monto_distribuir := v_total_pagado;
        
        FOR v_amortizacion IN 
            SELECT id, monto_cuota FROM public.amortizaciones 
            WHERE credito_id = v_credito.id
            ORDER BY numero_cuota ASC
        LOOP
            IF v_monto_distribuir <= 0 THEN
                EXIT;
            END IF;

            -- Apply payment to this installment
            v_monto_aplicar := LEAST(v_monto_distribuir, v_amortizacion.monto_cuota);
            
            UPDATE public.amortizaciones
            SET 
                saldo_pendiente = monto_cuota - v_monto_aplicar,
                estado = CASE 
                    WHEN (monto_cuota - v_monto_aplicar) <= 0.01 THEN 'pagada'
                    ELSE 'parcial' 
                END,
                updated_at = NOW()
            WHERE id = v_amortizacion.id;

            v_monto_distribuir := v_monto_distribuir - v_monto_aplicar;
        END LOOP;

        v_count_reparados := v_count_reparados + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'mensajes', 'Se han recalculado las amortizaciones para todos los créditos.',
        'creditos_procesados', v_count_reparados
    );
END;
$$;

-- Execute the repair immediately
SELECT public.reparar_sincronizacion_amortizaciones();

-- Optional: Clean up the repair function after use (uncomment if desired)
-- DROP FUNCTION public.reparar_sincronizacion_amortizaciones();
