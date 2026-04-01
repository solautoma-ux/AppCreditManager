-- FIX: Granular RLS for Clientes
-- Description: Fixes "row-level security policy violation" on INSERT.
-- Replaces generic policies with specific actions (SELECT, INSERT, UPDATE, DELETE).

-- 1. Asegurar permisos en funciones helper (por precaución)
GRANT EXECUTE ON FUNCTION public.current_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role TO authenticated;

-- 2. Limpiar políticas previas de clientes
DROP POLICY IF EXISTS "Admins manage own clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Select Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Insert Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Update Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Delete Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Super Admin Select All Clients" ON public.clientes;

-- 3. Crear políticas granulares para ADMIN

-- SELECT: Ver clientes propios
CREATE POLICY "Admin Select Own Clients" ON public.clientes
FOR SELECT USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- INSERT: Crear clientes (Debe coincidir el admin_id)
CREATE POLICY "Admin Insert Own Clients" ON public.clientes
FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- UPDATE: Editar clientes propios
CREATE POLICY "Admin Update Own Clients" ON public.clientes
FOR UPDATE USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- DELETE: Eliminar clientes propios
CREATE POLICY "Admin Delete Own Clients" ON public.clientes
FOR DELETE USING (
  public.current_user_role() = 'admin' 
  AND admin_id = public.current_user_id()
);

-- 4. Crear política para SUPER ADMIN (Solo Lectura Global por ahora)
CREATE POLICY "Super Admin Select All Clients" ON public.clientes
FOR SELECT USING (
  public.current_user_role() = 'super_admin'
);
