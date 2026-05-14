-- MIGRATION: 180_fix_security_definer_views.sql
-- DESCRIPTION: Corrección de vulnerabilidad detectada por Supabase Security Advisor (0010_security_definer_view).
-- Transforma las vistas de monitoreo a SECURITY INVOKER para que respeten las políticas RLS del usuario consultante.

ALTER VIEW public.monitor_unused_indexes SET (security_invoker = true);
ALTER VIEW public.monitor_table_sizes SET (security_invoker = true);
ALTER VIEW public.monitor_empty_tables SET (security_invoker = true);
