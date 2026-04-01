-- MIGRATION: 167_cleanup_users.sql
-- DESCRIPTION: Limpieza total de usuarios y datos relacionados, preservando solo al Super Admin.
-- USE WITH CAUTION: Elimina datos transaccionales.

BEGIN;

-- 1. Eliminar datos transaccionales (Orden por Claves Foráneas)
DELETE FROM pagos;
DELETE FROM audit_log;
DELETE FROM creditos;
DELETE FROM cartera_encargados;

-- 2. Eliminar entidades principales
DELETE FROM clientes;
DELETE FROM carteras;
DELETE FROM admin_subscriptions;
DELETE FROM subscription_payments;
-- DELETE FROM system_config WHERE key != 'global_settings'; -- Opcional (Comentado por error de columna)

-- 3. Eliminar Usuarios (Excepto Super Admin)
-- ID a preservar: 63b60fa7-e955-4873-9c19-a0f565638fbc
DELETE FROM usuarios 
WHERE id != '63b60fa7-e955-4873-9c19-a0f565638fbc';

COMMIT;

-- NOTA PARA EL USUARIO:
-- Después de ejecutar esto, debes ir al panel de Supabase > Authentication > Users
-- y borrar manualmente todos los usuarios EXCEPTO el del correo del Super Admin.
