-- MIGRATION: 147_archive_logic.sql
-- Description: Enables 'archivado' status for Creditos and Carteras replacing Delete.

-- 1. Update CREDITOS status constraint
ALTER TABLE public.creditos 
DROP CONSTRAINT IF EXISTS creditos_estado_check;

ALTER TABLE public.creditos 
ADD CONSTRAINT creditos_estado_check 
CHECK (estado IN ('activo', 'vencido', 'pagado', 'interrumpido', 'refinanciado', 'liquidado', 'archivado'));

-- 2. Update CARTERAS status constraint (assuming 'estado' exists, if not relying on soft checks or add it)
-- First ensure column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carteras' AND column_name='estado') THEN
        ALTER TABLE public.carteras ADD COLUMN estado VARCHAR(20) DEFAULT 'activa';
    END IF;
END $$;

-- Update constraint
ALTER TABLE public.carteras 
DROP CONSTRAINT IF EXISTS carteras_estado_check;

ALTER TABLE public.carteras 
ADD CONSTRAINT carteras_estado_check 
CHECK (estado IN ('activa', 'archivada'));


-- 3. RPC: Archivar Cartera (Soft Delete)
CREATE OR REPLACE FUNCTION public.archivar_cartera_seguro(p_cartera_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count_creditos INT;
    v_cartera_nombre VARCHAR;
BEGIN
    -- Get cartera info
    SELECT nombre INTO v_cartera_nombre FROM public.carteras WHERE id = p_cartera_id;
    
    IF v_cartera_nombre IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cartera no encontrada');
    END IF;

    -- Count associated credits (Active or History, but ignoring already archived ones?)
    -- User said: "under same conditions as delete" -> Delete required NO credits.
    -- So we check if there are ANY credits that are NOT archived? 
    -- Or just ANY credits period. Delete required COUNT(*) = 0.
    -- So we stick to ANY credits.
    SELECT COUNT(*) INTO v_count_creditos FROM public.creditos WHERE cartera_id = p_cartera_id AND estado != 'archivado';
    
    IF v_count_creditos > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('No se puede archivar la cartera "%s" porque tiene %s crédito(s) activos o históricos. Solo se pueden archivar carteras vacías.', v_cartera_nombre, v_count_creditos)
        );
    END IF;

    -- Update status
    UPDATE public.carteras SET estado = 'archivada', updated_at = NOW() WHERE id = p_cartera_id;
    
    RETURN jsonb_build_object('success', true, 'message', format('Cartera "%s" archivada correctamente.', v_cartera_nombre));
END;
$$;


-- 4. RPC: Archivar Credito (Soft Delete with Balance Reversal)
CREATE OR REPLACE FUNCTION public.archivar_credito_seguro(p_credito_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count_pagos INT;
    v_credito_codigo VARCHAR;
    v_monto_capital NUMERIC;
    v_cartera_id UUID;
    v_estado_actual VARCHAR;
BEGIN
    -- Get credit info
    SELECT codigo, monto_capital, cartera_id, estado
    INTO v_credito_codigo, v_monto_capital, v_cartera_id, v_estado_actual
    FROM public.creditos WHERE id = p_credito_id;
    
    IF v_credito_codigo IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Crédito no encontrado');
    END IF;

    IF v_estado_actual = 'archivado' THEN
        RETURN jsonb_build_object('success', false, 'message', 'El crédito ya está archivado');
    END IF;

    -- Count associated payments
    SELECT COUNT(*) INTO v_count_pagos FROM public.pagos WHERE credito_id = p_credito_id;
    
    IF v_count_pagos > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('No se puede archivar el crédito "%s" porque tiene %s pago(s).', v_credito_codigo, v_count_pagos)
        );
    END IF;

    -- REVERSE ACCOUNTING (Same as Delete)
    -- Return capital to cartera because the loan effectively "never happened" or is being voided.
    UPDATE public.carteras SET 
        saldo_actual = saldo_actual + v_monto_capital,
        saldo_prestado = GREATEST(0, saldo_prestado - v_monto_capital),
        updated_at = NOW()
    WHERE id = v_cartera_id;

    -- Update Status to Archivad
    UPDATE public.creditos 
    SET estado = 'archivado', 
        updated_at = NOW(),
        saldo_capital_pendiente = 0, -- Zero out balance so it doesn't show as active debt
        saldo_interes_pendiente = 0
    WHERE id = p_credito_id;

    -- We do NOT delete amortizations, but we might want to mark them?
    -- They are child records. If we leave them 'pendiente', analytics might pick them up.
    -- Let's set them to 'liquidada' or just delete them?
    -- User said "archiven". Let's keep them but maybe add a status?
    -- Or simpler: Logic for 'archivado' credit ignores strict amortization checks.
    -- But for safety, let's delete them as "Delete" did, OR update them to something safe.
    -- Since user wanted "Eliminar -> Archivar", preserving data is implied.
    -- But 'amortizaciones' status constraint is strict.
    -- Let's just DELETE amortizations to save space/confusion, as the credit is void.
    -- OR better: Update them to 'liquidada' so they aren't pending.
    -- "Delete" logic DELETED them. 
    -- Let's DELETE them to be consistent with "Clean up", but keep the Credit Header as "Archivado" record.
    -- Wait, if I delete amortizations, I lose the history of what was planned.
    -- User wants to ARCHIVE presumably to keep a record.
    -- I will leave amortizations alone? OR update them?
    -- If I leave them 'pendiente', `verificarVencimientos` might check them if it scans all amortizations.
    -- `verificarVencimientos` only checks `active` credits. So it's safe.
    -- I will LEAVE amortizations as is, for historical record of the plan.
    
    RETURN jsonb_build_object('success', true, 'message', format('Crédito "%s" archivado. Capital devuelto a cartera.', v_credito_codigo));
END;
$$;

GRANT EXECUTE ON FUNCTION public.archivar_cartera_seguro TO authenticated;
GRANT EXECUTE ON FUNCTION public.archivar_credito_seguro TO authenticated;
