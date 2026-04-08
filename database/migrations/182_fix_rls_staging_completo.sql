-- ================================================================
-- 182_fix_rls_staging_completo.sql
-- MIGRACIÓN MAESTRA DE SEGURIDAD
-- ================================================================
-- PROBLEMA: Las funciones current_user_role() y current_user_id()
-- no existen en Staging, entonces todas las políticas RLS fallan
-- silenciosamente y permiten acceso total a todos los datos.
--
-- SOLUCIÓN: 
--   1. Crear/reparar las funciones auxiliares de identidad
--   2. Eliminar todas las políticas inconsistentes
--   3. Recrear políticas limpias y correctas
-- ================================================================

-- ================================================================
-- PASO 1: CREAR/REPARAR FUNCIONES DE IDENTIDAD
-- Estas funciones leen la tabla usuarios SIN activar RLS (SECURITY DEFINER)
-- para evitar recursión infinita.
-- ================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
    SELECT rol FROM public.usuarios WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
    SELECT id FROM public.usuarios WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Garantizar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;

-- ================================================================
-- PASO 2: LIMPIAR POLÍTICAS EXISTENTES (para evitar conflictos)
-- ================================================================

-- CARTERAS
DROP POLICY IF EXISTS "Super Admin Select All" ON public.carteras;
DROP POLICY IF EXISTS "Admin Select Own" ON public.carteras;
DROP POLICY IF EXISTS "Admin Insert Own" ON public.carteras;
DROP POLICY IF EXISTS "Admin Update Own" ON public.carteras;
DROP POLICY IF EXISTS "Admin Delete Own" ON public.carteras;
DROP POLICY IF EXISTS "Encargados view assigned carteras" ON public.carteras;

-- CLIENTES
DROP POLICY IF EXISTS "Super Admin Select All Clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Select Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Insert Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Update Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Admin Delete Own Clients" ON public.clientes;
DROP POLICY IF EXISTS "Encargado Insert Clients" ON public.clientes;
DROP POLICY IF EXISTS "Encargado Select Shared Clients" ON public.clientes;
DROP POLICY IF EXISTS "Encargado Update Shared Clients" ON public.clientes;

-- CREDITOS
DROP POLICY IF EXISTS "Admin Select Own Credits" ON public.creditos;
DROP POLICY IF EXISTS "Admin Insert Own Credits" ON public.creditos;
DROP POLICY IF EXISTS "Admin Update Own Credits" ON public.creditos;
DROP POLICY IF EXISTS "Super Admin Select All Credits" ON public.creditos;
DROP POLICY IF EXISTS "Encargado Select Credits" ON public.creditos;
DROP POLICY IF EXISTS "Encargado Insert Credits" ON public.creditos;
DROP POLICY IF EXISTS "Encargado Update Credits" ON public.creditos;

-- AMORTIZACIONES
DROP POLICY IF EXISTS "Admin manage own amortizations" ON public.amortizaciones;
DROP POLICY IF EXISTS "Super Admin view all amortizations" ON public.amortizaciones;
DROP POLICY IF EXISTS "Encargado Select Amortizaciones" ON public.amortizaciones;

-- PAGOS
DROP POLICY IF EXISTS "Admin Select Pagos" ON public.pagos;
DROP POLICY IF EXISTS "Admin Insert Pagos" ON public.pagos;
DROP POLICY IF EXISTS "Encargado Select Pagos" ON public.pagos;
DROP POLICY IF EXISTS "Encargado Insert Pagos" ON public.pagos;
DROP POLICY IF EXISTS "Super Admin View All Pagos" ON public.pagos;

-- USUARIOS
DROP POLICY IF EXISTS "usuarios_read_self" ON public.usuarios;
DROP POLICY IF EXISTS "View Users" ON public.usuarios;
DROP POLICY IF EXISTS "Create Users" ON public.usuarios;
DROP POLICY IF EXISTS "Update Users" ON public.usuarios;
DROP POLICY IF EXISTS "Delete Users" ON public.usuarios;

-- ================================================================
-- PASO 3: HABILITAR RLS EN TODAS LAS TABLAS
-- ================================================================

ALTER TABLE public.carteras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amortizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PASO 4: RECREAR POLÍTICAS DE AISLAMIENTO POR ADMIN
-- ================================================================

-- ── CARTERAS ────────────────────────────────────────────────────
CREATE POLICY "carteras_super_admin_all"
ON public.carteras FOR SELECT TO public
USING (public.current_user_role() = 'super_admin');

CREATE POLICY "carteras_admin_select_own"
ON public.carteras FOR SELECT TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "carteras_admin_insert_own"
ON public.carteras FOR INSERT TO public
WITH CHECK (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "carteras_admin_update_own"
ON public.carteras FOR UPDATE TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "carteras_admin_delete_own"
ON public.carteras FOR DELETE TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "carteras_encargado_assigned"
ON public.carteras FOR SELECT TO public
USING (
    public.current_user_role() = 'encargado' AND
    EXISTS (
        SELECT 1 FROM public.cartera_encargados ce
        WHERE ce.cartera_id = carteras.id
          AND ce.encargado_id = public.current_user_id()
          AND ce.estado = 'activo'
    )
);

-- ── CLIENTES ─────────────────────────────────────────────────────
CREATE POLICY "clientes_super_admin_all"
ON public.clientes FOR SELECT TO public
USING (public.current_user_role() = 'super_admin');

CREATE POLICY "clientes_admin_select_own"
ON public.clientes FOR SELECT TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "clientes_admin_insert_own"
ON public.clientes FOR INSERT TO public
WITH CHECK (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "clientes_admin_update_own"
ON public.clientes FOR UPDATE TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "clientes_admin_delete_own"
ON public.clientes FOR DELETE TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "clientes_encargado_insert"
ON public.clientes FOR INSERT TO public
WITH CHECK (
    public.current_user_role() = 'encargado' AND
    creado_por_id = public.current_user_id()
);

CREATE POLICY "clientes_encargado_select_shared"
ON public.clientes FOR SELECT TO public
USING (
    public.current_user_role() = 'encargado' AND
    (creado_por_id = public.current_user_id() OR public.current_user_id() = ANY(colaboradores))
);

CREATE POLICY "clientes_encargado_update_shared"
ON public.clientes FOR UPDATE TO public
USING (
    public.current_user_role() = 'encargado' AND
    (creado_por_id = public.current_user_id() OR public.current_user_id() = ANY(colaboradores))
);

-- ── CRÉDITOS ─────────────────────────────────────────────────────
CREATE POLICY "creditos_super_admin_all"
ON public.creditos FOR SELECT TO public
USING (public.current_user_role() = 'super_admin');

CREATE POLICY "creditos_admin_select_own"
ON public.creditos FOR SELECT TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "creditos_admin_insert_own"
ON public.creditos FOR INSERT TO public
WITH CHECK (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "creditos_admin_update_own"
ON public.creditos FOR UPDATE TO public
USING (public.current_user_role() = 'admin' AND admin_id = public.current_user_id());

CREATE POLICY "creditos_encargado_select"
ON public.creditos FOR SELECT TO public
USING (
    public.current_user_role() = 'encargado' AND
    cartera_id IN (
        SELECT ce.cartera_id FROM public.cartera_encargados ce
        WHERE ce.encargado_id = public.current_user_id() AND ce.estado = 'activo'
    )
);

CREATE POLICY "creditos_encargado_insert"
ON public.creditos FOR INSERT TO public
WITH CHECK (
    public.current_user_role() = 'encargado' AND
    cartera_id IN (
        SELECT ce.cartera_id FROM public.cartera_encargados ce
        WHERE ce.encargado_id = public.current_user_id() AND ce.estado = 'activo'
    )
);

CREATE POLICY "creditos_encargado_update"
ON public.creditos FOR UPDATE TO public
USING (
    public.current_user_role() = 'encargado' AND
    cartera_id IN (
        SELECT ce.cartera_id FROM public.cartera_encargados ce
        WHERE ce.encargado_id = public.current_user_id() AND ce.estado = 'activo'
    )
);

-- ── AMORTIZACIONES ───────────────────────────────────────────────
CREATE POLICY "amortizaciones_super_admin_all"
ON public.amortizaciones FOR SELECT TO public
USING (public.current_user_role() = 'super_admin');

CREATE POLICY "amortizaciones_admin_own"
ON public.amortizaciones FOR ALL TO public
USING (
    EXISTS (
        SELECT 1 FROM public.creditos c
        WHERE c.id = amortizaciones.credito_id
          AND c.admin_id = public.current_user_id()
    )
);

CREATE POLICY "amortizaciones_encargado_select"
ON public.amortizaciones FOR SELECT TO public
USING (
    public.current_user_role() = 'encargado' AND
    EXISTS (
        SELECT 1 FROM public.creditos c
        JOIN public.cartera_encargados ce ON c.cartera_id = ce.cartera_id
        WHERE c.id = amortizaciones.credito_id
          AND ce.encargado_id = public.current_user_id()
          AND ce.estado = 'activo'
    )
);

-- ── PAGOS ────────────────────────────────────────────────────────
CREATE POLICY "pagos_super_admin_all"
ON public.pagos FOR SELECT TO public
USING (public.current_user_role() = 'super_admin');

CREATE POLICY "pagos_admin_select_own"
ON public.pagos FOR SELECT TO public
USING (
    public.current_user_role() = 'admin' AND
    EXISTS (
        SELECT 1 FROM public.creditos c
        WHERE c.id = pagos.credito_id AND c.admin_id = public.current_user_id()
    )
);

CREATE POLICY "pagos_admin_insert_own"
ON public.pagos FOR INSERT TO public
WITH CHECK (
    public.current_user_role() = 'admin' AND
    EXISTS (
        SELECT 1 FROM public.creditos c
        WHERE c.id = pagos.credito_id AND c.admin_id = public.current_user_id()
    )
);

CREATE POLICY "pagos_encargado_select"
ON public.pagos FOR SELECT TO public
USING (
    public.current_user_role() = 'encargado' AND
    EXISTS (
        SELECT 1 FROM public.creditos c
        JOIN public.cartera_encargados ce ON c.cartera_id = ce.cartera_id
        WHERE c.id = pagos.credito_id
          AND ce.encargado_id = public.current_user_id()
          AND ce.estado = 'activo'
    )
);

CREATE POLICY "pagos_encargado_insert"
ON public.pagos FOR INSERT TO public
WITH CHECK (
    public.current_user_role() = 'encargado' AND
    EXISTS (
        SELECT 1 FROM public.creditos c
        JOIN public.cartera_encargados ce ON c.cartera_id = ce.cartera_id
        WHERE c.id = pagos.credito_id
          AND ce.encargado_id = public.current_user_id()
          AND ce.estado = 'activo'
    )
);

-- ── USUARIOS ─────────────────────────────────────────────────────
CREATE POLICY "usuarios_self_read"
ON public.usuarios FOR SELECT TO authenticated
USING (auth_id = auth.uid());

CREATE POLICY "usuarios_view_hierarchy"
ON public.usuarios FOR SELECT TO public
USING (
    public.current_user_role() = 'super_admin'
    OR (public.current_user_role() = 'admin' AND admin_padre_id = public.current_user_id())
);

CREATE POLICY "usuarios_create"
ON public.usuarios FOR INSERT TO public
WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (public.current_user_role() = 'admin' AND rol = 'encargado' AND admin_padre_id = public.current_user_id())
);

CREATE POLICY "usuarios_update"
ON public.usuarios FOR UPDATE TO public
USING (
    public.current_user_role() = 'super_admin'
    OR (public.current_user_role() = 'admin' AND admin_padre_id = public.current_user_id())
    OR auth_id = auth.uid()
)
WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (public.current_user_role() = 'admin' AND admin_padre_id = public.current_user_id())
    OR auth_id = auth.uid()
);

CREATE POLICY "usuarios_delete"
ON public.usuarios FOR DELETE TO public
USING (
    public.current_user_role() = 'super_admin'
    OR (public.current_user_role() = 'admin' AND admin_padre_id = public.current_user_id())
);

-- ================================================================
-- VERIFICACIÓN: Ejecuta esto para confirmar que tu rol se detecta
-- SELECT public.current_user_role(), public.current_user_id();
-- ================================================================
