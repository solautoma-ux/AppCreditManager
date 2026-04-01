-- MIGRATION: 172_check_unused_tables.sql
-- DESCRIPTION: Detectar tablas vacías o con muy poco uso (Posible basura)

CREATE OR REPLACE VIEW public.monitor_empty_tables AS
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE n_live_tup = 0
AND schemaname = 'public' -- SEGURIDAD: Solo tablas del usuario
ORDER BY pg_total_relation_size(relid) DESC;
