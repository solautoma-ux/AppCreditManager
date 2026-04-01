-- MIGRATION: 131_nuke_credito_triggers.sql
-- Description: Aggressively drops ALL triggers on 'creditos' table to prevent double-counting of balance updates.
-- The RPC 'crear_credito_completo' already handles balance updates transactionally.
-- Any trigger doing the same will cause data corruption.

DO $$ 
DECLARE 
    tgt RECORD;
BEGIN 
    FOR tgt IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'creditos' 
        AND trigger_schema = 'public'
    LOOP 
        RAISE NOTICE 'Dropping trigger: %', tgt.trigger_name;
        EXECUTE 'DROP TRIGGER IF EXISTS "' || tgt.trigger_name || '" ON public.creditos'; 
    END LOOP; 
END $$;

-- Recalculate balances again to fix the current error (40M -> 30M)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.carteras LOOP
        PERFORM public.recalcular_saldos_cartera(r.id);
    END LOOP;
END;
$$;
