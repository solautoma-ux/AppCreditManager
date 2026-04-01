-- MIGRATION: 141_add_vencido_refinanciado_status
-- Adds 'vencido' and 'refinanciado' to the allowed states for credits

-- Drop old constraint
ALTER TABLE public.creditos 
DROP CONSTRAINT IF EXISTS creditos_estado_check;

-- Add new constraint with all valid states
ALTER TABLE public.creditos 
ADD CONSTRAINT creditos_estado_check 
CHECK (estado IN ('activo', 'pagado', 'mora', 'liquidado', 'vencido', 'refinanciado'));
