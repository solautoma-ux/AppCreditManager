-- FIX SCRIPT V2: Link existing Super Admin (Robust)
-- Execute this in Supabase SQL Editor

-- 1. Asegurar que el usuario existe (Case Insensitive check)
INSERT INTO public.usuarios (email, nombre, apellido, rol, estado)
VALUES ('solautoma@gmail.com', 'Super', 'Admin', 'super_admin', 'activo')
ON CONFLICT (email) DO UPDATE 
SET rol = 'super_admin', estado = 'activo';

-- 2. Forzar la vinculación (Case Insensitive)
UPDATE public.usuarios pu
SET auth_id = au.id,
    avatar_url = au.raw_user_meta_data->>'avatar_url',
    updated_at = now()
FROM auth.users au
WHERE lower(pu.email) = lower(au.email) 
  AND lower(pu.email) = 'solautoma@gmail.com';

-- 3. Verificación (Muestra qué pasó)
SELECT 
    pu.email as public_email, 
    pu.auth_id as public_link_id, 
    au.email as auth_email, 
    au.id as auth_real_id 
FROM public.usuarios pu
LEFT JOIN auth.users au ON lower(pu.email) = lower(au.email)
WHERE lower(pu.email) = 'solautoma@gmail.com';
