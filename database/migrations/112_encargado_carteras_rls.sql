-- FIX: Allow Encargados to view their assigned Carteras
-- Description: Adds RLS policy for Encargados to SELECT carteras where they are assigned

-- 1. Policy for Encargados to SELECT their assigned carteras
DROP POLICY IF EXISTS "Encargados view assigned carteras" ON public.carteras;

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

-- Note: Encargados should NOT be able to INSERT, UPDATE or DELETE carteras
-- They only manage the credits/payments within the cartera
