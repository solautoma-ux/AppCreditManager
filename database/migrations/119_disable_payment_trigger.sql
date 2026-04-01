-- Drop Legacy Triggers that conflict with the Atomic Payment RPC
-- The trigger 'trigger_actualizar_saldos_credito' attempts to update balances on INSERT
-- but does not check for negative values, ensuring 'check constraint' failures on overpayment.
-- The new function 'registrar_pago_completo' handles this logic safely.

DROP TRIGGER IF EXISTS trigger_actualizar_saldos_credito ON public.pagos;
DROP FUNCTION IF EXISTS actualizar_saldos_credito();
