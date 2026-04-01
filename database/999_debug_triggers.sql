-- Query to list all triggers on specific tables
SELECT 
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_table IN ('pagos', 'creditos', 'carteras');
