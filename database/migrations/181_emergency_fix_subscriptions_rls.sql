-- 181_emergency_fix_subscriptions_rls.sql
-- PROBLEMA: Las políticas de admin_subscriptions usan current_user_role()
-- que puede devolver NULL en Staging, bloqueando la lectura y causando "N/A".
-- SOLUCIÓN: Reemplazar con políticas directas usando auth.uid() y subqueries.

-- 1. Eliminar políticas antiguas que dependen de current_user_role()
DROP POLICY IF EXISTS "Super Admins see all subscriptions" ON public.admin_subscriptions;
DROP POLICY IF EXISTS "Admins can view own subscription" ON public.admin_subscriptions;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.admin_subscriptions;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.admin_subscriptions;

-- 2. Aseguramos que el RLS está activo
ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Super Admin puede ver y gestionar TODAS las suscripciones
--    Usamos subquery directa a la tabla usuarios, sin depender de la función auxiliar
CREATE POLICY "Super Admin full access subscriptions"
ON public.admin_subscriptions
AS PERMISSIVE
FOR ALL
TO public
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
          AND u.rol = 'super_admin'
    )
);

-- 4. Admin puede ver su PROPIA suscripción
--    Comparamos admin_id con el id del usuario autenticado
CREATE POLICY "Admin view own subscription"
ON public.admin_subscriptions
AS PERMISSIVE
FOR SELECT
TO public
USING (
    admin_id = (
        SELECT id FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        LIMIT 1
    )
);

-- 5. Admin puede actualizar su PROPIA suscripción (para renovaciones)
CREATE POLICY "Admin update own subscription"
ON public.admin_subscriptions
AS PERMISSIVE
FOR UPDATE
TO public
USING (
    admin_id = (
        SELECT id FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        LIMIT 1
    )
);
