-- Migration: User Management Permissions (RLS)
-- Description: Defines who can create/edit whom. Implements Admin -> Encargado hierarchy.

-- 1. Helper Function to get Current User Role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
  SELECT rol FROM public.usuarios WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- 2. Enable RLS on public.usuarios (Ensure it's enabled)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 3. DROP Existing Policies to avoid conflicts (Clean Slate for this table)
DROP POLICY IF EXISTS "Users can see own profile" ON public.usuarios;
DROP POLICY IF EXISTS "Super Admins can see all" ON public.usuarios;
-- Add drops for any other generic policies you might have created

-- 4. DEFINE POLICIES

-- A. VIEW (SELECT)
-- Rule: You can see yourself OR You are Super Admin OR You are the Admin Parent of the target
CREATE POLICY "View Users" ON public.usuarios
FOR SELECT USING (
  auth_id = auth.uid()                                              -- See self
  OR public.current_user_role() = 'super_admin'                     -- Super Admin sees all
  OR (public.current_user_role() = 'admin' AND admin_padre_id = public.current_user_id()) -- Admin sees their Encargados
);

-- B. CREATE (INSERT)
-- Rule: Super Admin creates Admins/Encargados. Admin creates Encargados (assigned to them).
CREATE POLICY "Create Users" ON public.usuarios
FOR INSERT WITH CHECK (
  public.current_user_role() = 'super_admin'                        -- Super admin creates anyone
  OR (
    public.current_user_role() = 'admin'                            -- Admin...
    AND rol = 'encargado'                                           -- ...creates Encargado
    AND admin_padre_id = public.current_user_id()                   -- ...assigned to self
  )
);

-- C. UPDATE
-- Rule: Super Admin updates all. Admin updates their Encargados. Users update own (limited fields - handled by frontend/logic, RLS allows row access)
CREATE POLICY "Update Users" ON public.usuarios
FOR UPDATE USING (
  public.current_user_role() = 'super_admin'
  OR (
     public.current_user_role() = 'admin' 
     AND admin_padre_id = public.current_user_id()
  )
  OR auth_id = auth.uid() -- Users can update self (e.g. avatar, phone)
) WITH CHECK (
  public.current_user_role() = 'super_admin'
  OR (
     public.current_user_role() = 'admin' 
     AND admin_padre_id = public.current_user_id()
  )
  OR auth_id = auth.uid()
);

-- D. DELETE
-- Rule: Super Admin deletes all. Admin deletes their Encargados.
CREATE POLICY "Delete Users" ON public.usuarios
FOR DELETE USING (
  public.current_user_role() = 'super_admin'
  OR (
     public.current_user_role() = 'admin' 
     AND admin_padre_id = public.current_user_id()
  )
);
