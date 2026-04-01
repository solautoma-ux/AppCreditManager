-- FIX: Encargados can view credits they created or in their assigned carteras
-- Problem: Encargados can create credits but can't see them

-- 1. Drop existing Encargado policies if they exist
DROP POLICY IF EXISTS "Encargado Select Credits" ON public.creditos;
DROP POLICY IF EXISTS "Encargado Insert Credits" ON public.creditos;

-- 2. Create RLS policies for Encargados

-- SELECT: Encargado puede ver créditos de carteras que administra
CREATE POLICY "Encargado Select Credits" ON public.creditos
FOR SELECT USING (
  public.current_user_role() = 'encargado' 
  AND cartera_id IN (
    SELECT cartera_id FROM public.cartera_encargados 
    WHERE encargado_id = public.current_user_id() 
    AND estado = 'activo'
  )
);

-- INSERT: Encargado puede crear créditos en carteras que administra
-- Nota: La función crear_credito_completo ya valida, pero esto permite el INSERT directo si se necesita
CREATE POLICY "Encargado Insert Credits" ON public.creditos
FOR INSERT WITH CHECK (
  public.current_user_role() = 'encargado'
  AND cartera_id IN (
    SELECT cartera_id FROM public.cartera_encargados 
    WHERE encargado_id = public.current_user_id() 
    AND estado = 'activo'
  )
);

-- UPDATE: Encargado puede actualizar créditos de sus carteras
CREATE POLICY "Encargado Update Credits" ON public.creditos
FOR UPDATE USING (
  public.current_user_role() = 'encargado' 
  AND cartera_id IN (
    SELECT cartera_id FROM public.cartera_encargados 
    WHERE encargado_id = public.current_user_id() 
    AND estado = 'activo'
  )
);

-- Grant permissions
GRANT ALL ON public.creditos TO authenticated;
