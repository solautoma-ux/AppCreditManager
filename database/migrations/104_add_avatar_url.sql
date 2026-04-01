-- FIX: Add missing avatar_url column
-- Description: The invitation trigger handle_new_user() tries to set avatar_url,
-- but the column was missing in the original table definition.

-- 1. Agregar la columna avatar_url
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Verificación
-- Al crear un nuevo usuario e iniciar sesión con Google,
-- el trigger ahora podrá guardar la foto de perfil sin crashing.
