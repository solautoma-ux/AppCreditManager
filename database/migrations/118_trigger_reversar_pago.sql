-- Trigger function to handle Payment Deletion (Reversal)
-- Ensures that if a payment record is deleted, its financial effects are reversed.

CREATE OR REPLACE FUNCTION reversar_pago_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cartera_id UUID;
BEGIN
    -- 1. Reverse Credit Balance (Add back the debt)
    -- We assume the payment is valid and simply add the amounts back.
    UPDATE public.creditos
    SET 
        saldo_capital_pendiente = saldo_capital_pendiente + OLD.monto_a_capital,
        saldo_interes_pendiente = saldo_interes_pendiente + OLD.monto_a_interes,
        -- If it was liquidado, it must return to activo because debt is back.
        -- If it was activo, it stays activo.
        estado = 'activo', 
        updated_at = NOW()
    WHERE id = OLD.credito_id
    RETURNING cartera_id INTO v_cartera_id;

    -- 2. Reverse Cartera Balance (Subtract the money from cash flow)
    IF v_cartera_id IS NOT NULL THEN
        UPDATE public.carteras
        SET 
            saldo_actual = saldo_actual - OLD.monto_total,
            updated_at = NOW()
        WHERE id = v_cartera_id;
    END IF;

    RETURN OLD;
END;
$$;

-- Drop trigger if exists to avoid duplication errors during migrations
DROP TRIGGER IF EXISTS on_delete_pago ON public.pagos;

-- Create the Trigger
CREATE TRIGGER on_delete_pago
AFTER DELETE ON public.pagos
FOR EACH ROW
EXECUTE FUNCTION reversar_pago_trigger();
