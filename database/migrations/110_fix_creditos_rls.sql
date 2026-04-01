-- FIX: Granular RLS for Creditos
-- Description: Fixes issue where credits don't appear in list despite being saved.
-- The table has RLS enabled but no policies allowing SELECT for admins.

-- 1. Asegurar que RLS está habilitado
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas previas
DROP POLICY IF EXISTS "Admin Select Own Credits" ON public.creditos;
DROP POLICY IF EXISTS "Admin Insert Own Credits" ON public.creditos;
DROP POLICY IF EXISTS "Admin Update Own Credits" ON public.creditos;
DROP POLICY IF EXISTS "Super Admin Select All Credits" ON public.creditos;

-- 3. Crear políticas granulares para ADMIN

-- SELECT: Ver créditos propios
CREATE POLICY "Admin Select Own Credits" ON public.creditos
FOR SELECT USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- INSERT: Crear créditos (admin_id debe coincidir)
CREATE POLICY "Admin Insert Own Credits" ON public.creditos
FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- UPDATE: Editar créditos propios
CREATE POLICY "Admin Update Own Credits" ON public.creditos
FOR UPDATE USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- 4. Crear política para SUPER ADMIN (Lectura Global)
CREATE POLICY "Super Admin Select All Credits" ON public.creditos
FOR SELECT USING (
  public.current_user_role() = 'super_admin'
);

-- 5. Grant permissions
GRANT ALL ON public.creditos TO authenticated;
