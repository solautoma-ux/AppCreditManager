-- FIX: Add INSERT policy for cartera_encargados
-- Description: Allows admins to assign encargados to their own carteras

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Admins view assignments" ON public.cartera_encargados;
DROP POLICY IF EXISTS "Admins insert assignments" ON public.cartera_encargados;
DROP POLICY IF EXISTS "Admins delete assignments" ON public.cartera_encargados;

-- SELECT: Admin puede ver asignaciones de sus carteras
CREATE POLICY "Admins view assignments" ON public.cartera_encargados
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.carteras 
    WHERE public.carteras.id = cartera_encargados.cartera_id 
    AND public.carteras.admin_id = public.current_user_id()
  )
);

-- INSERT: Admin puede crear asignaciones para sus carteras
CREATE POLICY "Admins insert assignments" ON public.cartera_encargados
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.carteras 
    WHERE public.carteras.id = cartera_encargados.cartera_id 
    AND public.carteras.admin_id = public.current_user_id()
  )
);

-- DELETE: Admin puede eliminar asignaciones de sus carteras
CREATE POLICY "Admins delete assignments" ON public.cartera_encargados
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.carteras 
    WHERE public.carteras.id = cartera_encargados.cartera_id 
    AND public.carteras.admin_id = public.current_user_id()
  )
);

-- Grant
GRANT ALL ON public.cartera_encargados TO authenticated;
