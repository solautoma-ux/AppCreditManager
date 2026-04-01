-- DATA FIX: 999_fix_liquidado_status.sql
-- Description: Updates credits that were incorrectly marked as 'liquidado' (old status) 
-- to 'pagado' (new status) if they have a balance of zero.

UPDATE public.creditos
SET 
    estado = 'pagado',
    updated_at = NOW()
WHERE 
    estado = 'liquidado' 
    AND saldo_capital_pendiente <= 0;

-- Confirmation output
SELECT count(*) as fixed_credits FROM public.creditos WHERE estado = 'pagado' AND updated_at >= (NOW() - INTERVAL '1 minute');
