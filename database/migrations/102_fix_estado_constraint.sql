-- FIX: Update estado constraint to allow 'pendiente'
-- Description: The original constraint only allowed ('activo', 'inactivo').
-- This script updates it to include 'pendiente' for the invitation flow.

-- 1. Eliminar la restricción antigua (el nombre suele ser usuarios_estado_check)
ALTER TABLE public.usuarios 
DROP CONSTRAINT IF EXISTS usuarios_estado_check;

-- 2. Agregar la nueva restricción con 'pendiente' incluido
ALTER TABLE public.usuarios 
ADD CONSTRAINT usuarios_estado_check 
CHECK (estado IN ('activo', 'inactivo', 'pendiente'));

-- 3. Verificación
-- Al crear un administrador ahora no debería dar error de restricción.
