-- FIX: RLS for Amortizaciones for "Encargados"
-- Problem: Encargados can see credits, but not their amortization schedule (empty table).
-- Solution: Add RLS policy allowing SELECT if the amortization belongs to a credit in a managed portfolio.

DROP POLICY IF EXISTS "Encargado Select Amortizaciones" ON public.amortizaciones;

CREATE POLICY "Encargado Select Amortizaciones" ON public.amortizaciones
FOR SELECT USING (
  public.current_user_role() = 'encargado' 
  AND EXISTS (
      SELECT 1 FROM public.creditos c
      JOIN public.cartera_encargados ce ON c.cartera_id = ce.cartera_id
      WHERE c.id = amortizaciones.credito_id
      AND ce.encargado_id = public.current_user_id()
      AND ce.estado = 'activo'
  )
);
