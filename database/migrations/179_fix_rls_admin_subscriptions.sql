-- 179_fix_rls_admin_subscriptions.sql
-- ESTA MIGRACIÓN HABILITA LA LECTURA DE LAS SUSCRIPCIONES PARA QUE NO APAREZCA "N/A" EN EL FRONTEND

-- 1. Nos aseguramos de que el RLS esté activo (por seguridad)
ALTER TABLE "public"."admin_subscriptions" ENABLE ROW LEVEL SECURITY;

-- 2. Borramos cualquier política de lectura antigua que pueda estar causando conflictos
DROP POLICY IF EXISTS "Allow read for authenticated users" ON "public"."admin_subscriptions";
DROP POLICY IF EXISTS "Super Admin can see all subscriptions" ON "public"."admin_subscriptions";

-- 3. Creamos la política definitiva: Todo usuario autenticado puede LEER las suscripciones
-- Esto permite que el Super Admin vea los vencimientos de todos los Admins
CREATE POLICY "Allow read for authenticated users" 
ON "public"."admin_subscriptions" 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 4. Nos aseguramos de que también puedan actualizarla (para renovaciones)
DROP POLICY IF EXISTS "Allow update for authenticated users" ON "public"."admin_subscriptions";
CREATE POLICY "Allow update for authenticated users" 
ON "public"."admin_subscriptions" 
FOR UPDATE 
USING (auth.role() = 'authenticated');
