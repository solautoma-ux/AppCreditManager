-- Migration: 159_clean_liquidado_audit.sql
-- Description: Deletes audit log records that reference the forbidden state 'liquidado'.

DELETE FROM public.audit_log
WHERE 
    valor_nuevo = '"liquidado"' 
    OR valor_nuevo = 'liquidado'
    OR valor_anterior = '"liquidado"'
    OR valor_anterior = 'liquidado';

-- Optional: If you also want to remove logs about 'motivo_cierre' since the column is being deleted
-- DELETE FROM public.audit_log WHERE campo_modificado = 'motivo_cierre';
