-- FIX RLS RECURSION (Critical)
-- El problema es que la política de seguridad llama a una función que lee la misma tabla,
-- creando un bucle infinito. Al final la base de datos bloquea el acceso.
-- Solución: Usar SECURITY DEFINER para que las funciones ignoren RLS.

-- 1. Arreglar current_user_role (Evitar bucle en View Users)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
  SELECT rol FROM public.usuarios WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER; 
-- SECURITY DEFINER = Ejecutar como dueño de la DB (ignorando RLS)

-- 2. Arreglar current_user_id (Evitar bucle en INSERT/UPDATE)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.usuarios WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Confirmación
-- Si ejecutas esto, deberías ver tu rol:
SELECT public.current_user_role();
