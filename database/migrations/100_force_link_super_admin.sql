-- FIX SCRIPT V3: BRUTE FORCE LINK (Specific ID)
-- Execute this in Supabase SQL Editor

-- 1. Asegurar que el usuario existe (Crea el super admin si no está)
INSERT INTO public.usuarios (email, nombre, apellido, rol, estado)
VALUES ('solautoma@gmail.com', 'Super', 'Admin', 'super_admin', 'activo')
ON CONFLICT (email) DO UPDATE 
SET rol = 'super_admin', estado = 'activo';

-- 2. VINCULACIÓN DIRECTA (Usando el ID que vimos en la foto)
-- Esto no puede fallar porque usamos el ID exacto.
UPDATE public.usuarios
SET auth_id = '63b60fa7-e955-4873-9c19-a0f565638fbc', -- Copiado del Debug Info
    updated_at = now()
WHERE email = 'solautoma@gmail.com';

-- 3. Verificación
SELECT * FROM public.usuarios WHERE email = 'solautoma@gmail.com';
