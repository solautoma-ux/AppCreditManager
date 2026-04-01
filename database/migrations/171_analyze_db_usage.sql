-- MIGRATION: 171_analyze_db_usage.sql
-- DESCRIPTION: Script de análisis para detectar índices no usados y tablas pesadas (Optimización)
-- NOTA: Este script NO modifica nada, solo consulta vistas del sistema.

-- 1. Vista para detectar índices con CERO uso (Candidatos a eliminar)
CREATE OR REPLACE VIEW public.monitor_unused_indexes AS
SELECT
    schemaname || '.' || relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    idx_scan as times_used
FROM pg_stat_user_indexes i
JOIN pg_index using (indexrelid)
WHERE idx_scan = 0
AND indisunique IS FALSE -- No sugerir eliminar índices únicos (constraints)
AND schemaname = 'public'; -- SEGURIDAD: Solo mostrar índices del usuario, no del sistema (auth, storage)

-- 2. Vista para ver tablas más pesadas
CREATE OR REPLACE VIEW public.monitor_table_sizes AS
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_total_relation_size(relid) AS total_bytes,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
