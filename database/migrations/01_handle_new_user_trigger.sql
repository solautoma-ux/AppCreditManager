-- Migration: Handle Invite-Only Users
-- Description: Adds auth_id to public.usuarios, creates trigger for linking auth users, and updates RLS helper.

-- 1. Modify public.usuarios to support Invite Flow
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fecha_invitacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN estado SET DEFAULT 'pendiente';

-- 2. Function to handle new user signup (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Strict Invite-Only: Check if email exists in public.usuarios
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE email = new.email) THEN
    -- User was invited: Link Auth ID to existing Domain User
    UPDATE public.usuarios 
    SET auth_id = new.id, 
        avatar_url = new.raw_user_meta_data->>'avatar_url',
        estado = 'activo', -- Activate user
        updated_at = CURRENT_TIMESTAMP
    WHERE email = new.email;
    
    RETURN new;
  ELSE
    -- User NOT invited: Do NOT create row in public.usuarios.
    -- The user will exist in Auth but have no Domain record.
    -- Frontend will block access via "Unauthorized" page.
    RETURN new;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Helper function for RLS (Mapping Auth ID -> Domain ID)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.usuarios WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- 5. Update RLS Policies (Examples - You may need to apply this pattern to all tables)
-- Enable RLS just in case
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can see all users, Users can see themselves
CREATE POLICY "Users can see own profile" ON public.usuarios
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "Super Admins can see all" ON public.usuarios
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE auth_id = auth.uid() AND rol = 'super_admin')
  );

-- IMPORTANT: This migration assumes other tables (carteras, etc.) will use current_user_id() 
-- or join with usuarios instead of using auth.uid() directly for foreign keys.
