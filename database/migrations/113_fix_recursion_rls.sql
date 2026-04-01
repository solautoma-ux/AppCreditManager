-- FIX: Infinite Recursion in cartera_encargados RLS
-- Problem: The policy was querying 'carteras' which has RLS that may query back
-- Solution: Use 'asignado_por_id' directly (the admin who assigned) instead of subquery

-- 1. Drop all existing policies on cartera_encargados
DROP POLICY IF EXISTS "Admins view assignments" ON public.cartera_encargados;
DROP POLICY IF EXISTS "Admins insert assignments" ON public.cartera_encargados;
DROP POLICY IF EXISTS "Admins delete assignments" ON public.cartera_encargados;

-- 2. Recreate policies using direct field check (no subquery)

-- SELECT: Admin can view assignments they created
CREATE POLICY "Admins view own assignments" ON public.cartera_encargados
FOR SELECT USING (
  asignado_por_id = public.current_user_id()
  OR encargado_id = public.current_user_id()
);

-- INSERT: Admin can create assignments (they are the asignado_por_id)
CREATE POLICY "Admins insert assignments" ON public.cartera_encargados
FOR INSERT WITH CHECK (
  asignado_por_id = public.current_user_id()
);

-- DELETE: Admin can delete assignments they created
CREATE POLICY "Admins delete own assignments" ON public.cartera_encargados
FOR DELETE USING (
  asignado_por_id = public.current_user_id()
);

-- Super Admin full access
CREATE POLICY "Super Admin full access cartera_encargados" ON public.cartera_encargados
USING (public.current_user_role() = 'super_admin');
