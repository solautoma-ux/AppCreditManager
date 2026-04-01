-- Migration: Carteras RLS (Security)
-- Description: Ensures Admins only manage their own wallets and Super Admins see everything.
-- Prerequisite: current_user_id() and current_user_role() functions.

-- 1. Habilitar RLS en la tabla carteras
ALTER TABLE public.carteras ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas existentes
DROP POLICY IF EXISTS "admin_carteras" ON public.carteras;
DROP POLICY IF EXISTS "encargado_carteras" ON public.carteras;
DROP POLICY IF EXISTS "Super Admins see all carteras" ON public.carteras;

-- 3. Política para Super Admin (Ver todo)
CREATE POLICY "Super Admins see all carteras" ON public.carteras
FOR ALL USING (
  public.current_user_role() = 'super_admin'
);

-- 4. Política para Admins (Ver sus propias carteras)
CREATE POLICY "Admins manage own carteras" ON public.carteras
FOR ALL USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- 5. Política para Encargados (Solo lectura de carteras asignadas)
CREATE POLICY "Encargados view assigned carteras" ON public.carteras
FOR SELECT USING (
  public.current_user_role() = 'encargado'
  AND EXISTS (
    SELECT 1 FROM public.cartera_encargados ce
    WHERE ce.cartera_id = carteras.id 
    AND ce.encargado_id = public.current_user_id()
    AND ce.estado = 'activo'
  )
);
