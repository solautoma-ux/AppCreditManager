-- FIX: Ensure Super Admin visibility for Carteras
-- Description: The granular policies might have excluded the Super Admin from seeing other admins' wallets.
-- This script explicitly adds a SELECT policy for Super Admins.

-- 1. Limpiar política similar si existe (para evitar duplicados o conflictos)
DROP POLICY IF EXISTS "Super Admins see all carteras" ON public.carteras;
DROP POLICY IF EXISTS "Super Admin Select All" ON public.carteras;

-- 2. Crear política explícita para Super Admin (Ver TODO)
CREATE POLICY "Super Admin Select All" ON public.carteras
FOR SELECT USING (
  public.current_user_role() = 'super_admin'
);

-- 3. Verificación
-- Ahora el conteo de carteras debería funcionar para el Super Admin
