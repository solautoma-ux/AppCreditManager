-- FIX: Allow 'liquidada' status in CHECK constraints
-- Error: "new row for relation "amortizaciones" violates check constraint "amortizaciones_estado_check""

-- 1. Update Amortizaciones Check Constraint
ALTER TABLE public.amortizaciones 
DROP CONSTRAINT IF EXISTS amortizaciones_estado_check;

ALTER TABLE public.amortizaciones 
ADD CONSTRAINT amortizaciones_estado_check 
CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'mora', 'liquidada'));

-- 2. Update Creditos Check Constraint (just in case strict check exists)
ALTER TABLE public.creditos 
DROP CONSTRAINT IF EXISTS creditos_estado_check;

ALTER TABLE public.creditos 
ADD CONSTRAINT creditos_estado_check 
CHECK (estado IN ('activo', 'pagado', 'mora', 'liquidado'));
