-- MIGRATION: 127_shared_clientes.sql
-- Description: Allows clients to be shared with multiple Encargados using a 'colaboradores' array.
-- This enables the "Link to my list" feature.

-- 1. Add colaboradores column
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS colaboradores UUID[] DEFAULT '{}';

-- 2. Index for array searches (optional but recommended for scale)
CREATE INDEX IF NOT EXISTS idx_clientes_colaboradores ON public.clientes USING GIN (colaboradores);

-- 3. Update RLS policies for Encargados to include colaboradores
DROP POLICY IF EXISTS "Encargado Select Own Clients" ON public.clientes;
CREATE POLICY "Encargado Select Shared Clients" ON public.clientes
FOR SELECT USING (
  public.current_user_role() = 'encargado' 
  AND (
    creado_por_id = public.current_user_id() 
    OR public.current_user_id() = ANY(colaboradores)
  )
);

-- Allow Update if linked
DROP POLICY IF EXISTS "Encargado Update Own Clients" ON public.clientes;
CREATE POLICY "Encargado Update Shared Clients" ON public.clientes
FOR UPDATE USING (
  public.current_user_role() = 'encargado' 
  AND (
    creado_por_id = public.current_user_id() 
    OR public.current_user_id() = ANY(colaboradores)
  )
);

-- Note: Admin policies already allow seeing EVERYTHING in their admin_id, 
-- regardless of creado_por_id or colaboradores.
