-- FIX: Granular RLS for Carteras
-- Description: "FOR ALL" policies can be tricky with INSERTs. 
-- Splitting into distinct policies ensures the WITH CHECK clause is applied correctly.

-- 1. Asegurar permisos en funciones
GRANT EXECUTE ON FUNCTION public.current_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role TO authenticated;

-- 2. Limpiar políticas previas de carteras
DROP POLICY IF EXISTS "Admins manage own carteras" ON public.carteras;
DROP POLICY IF EXISTS "Admin Select Own" ON public.carteras;
DROP POLICY IF EXISTS "Admin Insert Own" ON public.carteras;
DROP POLICY IF EXISTS "Admin Update Own" ON public.carteras;
DROP POLICY IF EXISTS "Admin Delete Own" ON public.carteras;

-- 3. Crear políticas granulares

-- SELECT: Ver carteras propias
CREATE POLICY "Admin Select Own" ON public.carteras
FOR SELECT USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- INSERT: Crear carteras propias (Debe coincidir el admin_id)
CREATE POLICY "Admin Insert Own" ON public.carteras
FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- UPDATE: Editar carteras propias
CREATE POLICY "Admin Update Own" ON public.carteras
FOR UPDATE USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- DELETE: Eliminar carteras propias
CREATE POLICY "Admin Delete Own" ON public.carteras
FOR DELETE USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);
