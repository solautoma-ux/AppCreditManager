-- RLS for Pagos (Payments) Table
-- Ensures Admins and Encargados can manage payments appropriately

-- 1. Enable RLS
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Admin Select Pagos" ON public.pagos;
DROP POLICY IF EXISTS "Admin Insert Pagos" ON public.pagos;
DROP POLICY IF EXISTS "Encargado Select Pagos" ON public.pagos;
DROP POLICY IF EXISTS "Encargado Insert Pagos" ON public.pagos;

-- 3. Admin Policies

-- SELECT: Admin can view payments for credits they own
CREATE POLICY "Admin Select Pagos" ON public.pagos
FOR SELECT USING (
  public.current_user_role() = 'admin' 
  AND EXISTS (
    SELECT 1 FROM public.creditos c 
    WHERE c.id = pagos.credito_id 
    AND c.admin_id = public.current_user_id()
  )
);

-- INSERT: Admin can create payments for their credits
CREATE POLICY "Admin Insert Pagos" ON public.pagos
FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.creditos c 
    WHERE c.id = pagos.credito_id 
    AND c.admin_id = public.current_user_id()
  )
);

-- 4. Encargado Policies

-- SELECT: Encargado can view payments for credits in their assigned carteras
CREATE POLICY "Encargado Select Pagos" ON public.pagos
FOR SELECT USING (
  public.current_user_role() = 'encargado'
  AND EXISTS (
    SELECT 1 FROM public.creditos c
    JOIN public.cartera_encargados ce ON c.cartera_id = ce.cartera_id
    WHERE c.id = pagos.credito_id
    AND ce.encargado_id = public.current_user_id()
    AND ce.estado = 'activo'
  )
);

-- INSERT: Encargado can create payments for credits in their assigned carteras
CREATE POLICY "Encargado Insert Pagos" ON public.pagos
FOR INSERT WITH CHECK (
  public.current_user_role() = 'encargado'
  AND EXISTS (
    SELECT 1 FROM public.creditos c
    JOIN public.cartera_encargados ce ON c.cartera_id = ce.cartera_id
    WHERE c.id = pagos.credito_id
    AND ce.encargado_id = public.current_user_id()
    AND ce.estado = 'activo'
  )
);

-- 5. Super Admin can view all
CREATE POLICY "Super Admin View All Pagos" ON public.pagos
FOR SELECT USING (
  public.current_user_role() = 'super_admin'
);

-- Grant permissions
GRANT ALL ON public.pagos TO authenticated;
