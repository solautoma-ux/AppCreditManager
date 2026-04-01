-- FIX: Add creado_por_id column to clientes and create Encargado RLS
-- Problem: Column creado_por_id does not exist
-- Solution: Add the column first, then create RLS policies

-- 1. Add the missing column
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS creado_por_id UUID REFERENCES public.usuarios(id);

-- 2. Set default value for existing records (set to admin_id since they were created by admin)
UPDATE public.clientes 
SET creado_por_id = admin_id 
WHERE creado_por_id IS NULL;

-- 3. Create index for the new column
CREATE INDEX IF NOT EXISTS idx_clientes_creado_por ON public.clientes(creado_por_id);

-- 4. Drop existing Encargado policies if they exist
DROP POLICY IF EXISTS "Encargado Select Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Encargado Insert Clients" ON public.clientes;
DROP POLICY IF EXISTS "Encargado Update Own Clients" ON public.clientes;

-- 5. Create RLS policies for Encargados

-- SELECT: Encargado puede ver clientes que creó
CREATE POLICY "Encargado Select Own Clients" ON public.clientes
FOR SELECT USING (
  public.current_user_role() = 'encargado' 
  AND creado_por_id = public.current_user_id()
);

-- INSERT: Encargado puede crear clientes
CREATE POLICY "Encargado Insert Clients" ON public.clientes
FOR INSERT WITH CHECK (
  public.current_user_role() = 'encargado'
  AND creado_por_id = public.current_user_id()
);

-- UPDATE: Encargado puede editar clientes que creó
CREATE POLICY "Encargado Update Own Clients" ON public.clientes
FOR UPDATE USING (
  public.current_user_role() = 'encargado' 
  AND creado_por_id = public.current_user_id()
);

-- Grant permissions
GRANT ALL ON public.clientes TO authenticated;
