-- =================================================
-- POLÍTICAS RLS - Extraídas de Producción (corregidas)
-- Pegar en SQL Editor de STAGING
-- =================================================

-- CARTERAS
ALTER TABLE public.carteras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admin Select All" ON public.carteras AS PERMISSIVE FOR SELECT TO public USING (((current_user_role())::text = 'super_admin'::text));
CREATE POLICY "Admin Select Own" ON public.carteras AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Insert Own" ON public.carteras AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Update Own" ON public.carteras AS PERMISSIVE FOR UPDATE TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Delete Own" ON public.carteras AS PERMISSIVE FOR DELETE TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Encargados view assigned carteras" ON public.carteras AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'encargado'::text) AND (EXISTS ( SELECT 1 FROM cartera_encargados ce WHERE ((ce.cartera_id = carteras.id) AND (ce.encargado_id = current_user_id()) AND ((ce.estado)::text = 'activo'::text))))));

-- CLIENTES
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admin Select All Clients" ON public.clientes AS PERMISSIVE FOR SELECT TO public USING (((current_user_role())::text = 'super_admin'::text));
CREATE POLICY "Admin Select Own Clients" ON public.clientes AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Insert Own Clients" ON public.clientes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Update Own Clients" ON public.clientes AS PERMISSIVE FOR UPDATE TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Delete Own Clients" ON public.clientes AS PERMISSIVE FOR DELETE TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Encargado Insert Clients" ON public.clientes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'encargado'::text) AND (creado_por_id = current_user_id())));
CREATE POLICY "Encargado Select Shared Clients" ON public.clientes AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'encargado'::text) AND ((creado_por_id = current_user_id()) OR (current_user_id() = ANY (colaboradores)))));
CREATE POLICY "Encargado Update Shared Clients" ON public.clientes AS PERMISSIVE FOR UPDATE TO public USING ((((current_user_role())::text = 'encargado'::text) AND ((creado_por_id = current_user_id()) OR (current_user_id() = ANY (colaboradores)))));

-- CREDITOS
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Select Own Credits" ON public.creditos AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Insert Own Credits" ON public.creditos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Admin Update Own Credits" ON public.creditos AS PERMISSIVE FOR UPDATE TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));
CREATE POLICY "Super Admin Select All Credits" ON public.creditos AS PERMISSIVE FOR SELECT TO public USING (((current_user_role())::text = 'super_admin'::text));
CREATE POLICY "Encargado Select Credits" ON public.creditos AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'encargado'::text) AND (cartera_id IN ( SELECT cartera_encargados.cartera_id FROM cartera_encargados WHERE ((cartera_encargados.encargado_id = current_user_id()) AND ((cartera_encargados.estado)::text = 'activo'::text))))));
CREATE POLICY "Encargado Insert Credits" ON public.creditos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'encargado'::text) AND (cartera_id IN ( SELECT cartera_encargados.cartera_id FROM cartera_encargados WHERE ((cartera_encargados.encargado_id = current_user_id()) AND ((cartera_encargados.estado)::text = 'activo'::text))))));
CREATE POLICY "Encargado Update Credits" ON public.creditos AS PERMISSIVE FOR UPDATE TO public USING ((((current_user_role())::text = 'encargado'::text) AND (cartera_id IN ( SELECT cartera_encargados.cartera_id FROM cartera_encargados WHERE ((cartera_encargados.encargado_id = current_user_id()) AND ((cartera_encargados.estado)::text = 'activo'::text))))));

-- AMORTIZACIONES
ALTER TABLE public.amortizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage own amortizations" ON public.amortizaciones AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1 FROM creditos c WHERE ((c.id = amortizaciones.credito_id) AND (c.admin_id = current_user_id())))));
CREATE POLICY "Super Admin view all amortizations" ON public.amortizaciones AS PERMISSIVE FOR SELECT TO public USING (((current_user_role())::text = 'super_admin'::text));
CREATE POLICY "Encargado Select Amortizaciones" ON public.amortizaciones AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'encargado'::text) AND (EXISTS ( SELECT 1 FROM (creditos c JOIN cartera_encargados ce ON ((c.cartera_id = ce.cartera_id))) WHERE ((c.id = amortizaciones.credito_id) AND (ce.encargado_id = current_user_id()) AND ((ce.estado)::text = 'activo'::text))))));

-- PAGOS
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Select Pagos" ON public.pagos AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'admin'::text) AND (EXISTS ( SELECT 1 FROM creditos c WHERE ((c.id = pagos.credito_id) AND (c.admin_id = current_user_id()))))));
CREATE POLICY "Admin Insert Pagos" ON public.pagos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'admin'::text) AND (EXISTS ( SELECT 1 FROM creditos c WHERE ((c.id = pagos.credito_id) AND (c.admin_id = current_user_id()))))));
CREATE POLICY "Encargado Select Pagos" ON public.pagos AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'encargado'::text) AND (EXISTS ( SELECT 1 FROM (creditos c JOIN cartera_encargados ce ON ((c.cartera_id = ce.cartera_id))) WHERE ((c.id = pagos.credito_id) AND (ce.encargado_id = current_user_id()) AND ((ce.estado)::text = 'activo'::text))))));
CREATE POLICY "Encargado Insert Pagos" ON public.pagos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'encargado'::text) AND (EXISTS ( SELECT 1 FROM (creditos c JOIN cartera_encargados ce ON ((c.cartera_id = ce.cartera_id))) WHERE ((c.id = pagos.credito_id) AND (ce.encargado_id = current_user_id()) AND ((ce.estado)::text = 'activo'::text))))));
CREATE POLICY "Super Admin View All Pagos" ON public.pagos AS PERMISSIVE FOR SELECT TO public USING (((current_user_role())::text = 'super_admin'::text));

-- CARTERA_ENCARGADOS
ALTER TABLE public.cartera_encargados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view own assignments" ON public.cartera_encargados AS PERMISSIVE FOR SELECT TO public USING (((asignado_por_id = current_user_id()) OR (encargado_id = current_user_id())));
CREATE POLICY "Admins insert assignments" ON public.cartera_encargados AS PERMISSIVE FOR INSERT TO public WITH CHECK ((asignado_por_id = current_user_id()));
CREATE POLICY "Admins delete own assignments" ON public.cartera_encargados AS PERMISSIVE FOR DELETE TO public USING ((asignado_por_id = current_user_id()));
CREATE POLICY "Super Admin full access cartera_encargados" ON public.cartera_encargados AS PERMISSIVE FOR ALL TO public USING (((current_user_role())::text = 'super_admin'::text));

-- USUARIOS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios_read_self" ON public.usuarios AS PERMISSIVE FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "View Users" ON public.usuarios AS PERMISSIVE FOR SELECT TO public USING (((auth_id = auth.uid()) OR ((current_user_role())::text = 'super_admin'::text) OR (((current_user_role())::text = 'admin'::text) AND (admin_padre_id = current_user_id()))));
CREATE POLICY "Create Users" ON public.usuarios AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((current_user_role())::text = 'super_admin'::text) OR (((current_user_role())::text = 'admin'::text) AND ((rol)::text = 'encargado'::text) AND (admin_padre_id = current_user_id()))));
CREATE POLICY "Update Users" ON public.usuarios AS PERMISSIVE FOR UPDATE TO public USING ((((current_user_role())::text = 'super_admin'::text) OR (((current_user_role())::text = 'admin'::text) AND (admin_padre_id = current_user_id())) OR (auth_id = auth.uid()))) WITH CHECK ((((current_user_role())::text = 'super_admin'::text) OR (((current_user_role())::text = 'admin'::text) AND (admin_padre_id = current_user_id())) OR (auth_id = auth.uid())));
CREATE POLICY "Delete Users" ON public.usuarios AS PERMISSIVE FOR DELETE TO public USING ((((current_user_role())::text = 'super_admin'::text) OR (((current_user_role())::text = 'admin'::text) AND (admin_padre_id = current_user_id()))));

-- ADMIN_SUBSCRIPTIONS
ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admins see all subscriptions" ON public.admin_subscriptions AS PERMISSIVE FOR ALL TO public USING (((current_user_role())::text = 'super_admin'::text));
CREATE POLICY "Admins can view own subscription" ON public.admin_subscriptions AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'admin'::text) AND (admin_id = current_user_id())));

-- SUBSCRIPTION_PAYMENTS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view own subscription payments" ON public.subscription_payments AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM admin_subscriptions s WHERE ((s.id = subscription_payments.subscription_id) AND (s.admin_id = current_user_id())))));
CREATE POLICY "Super Admins see all subscription payments" ON public.subscription_payments AS PERMISSIVE FOR ALL TO public USING (((current_user_role())::text = 'super_admin'::text));

-- NOTIFICACIONES_WHATSAPP
ALTER TABLE public.notificaciones_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see own related notifications" ON public.notificaciones_whatsapp AS PERMISSIVE FOR SELECT TO public USING ((((current_user_role())::text = 'super_admin'::text) OR (((current_user_role())::text = 'admin'::text) AND true)));
CREATE POLICY "Super Admins manage all notifications" ON public.notificaciones_whatsapp AS PERMISSIVE FOR ALL TO public USING (((current_user_role())::text = 'super_admin'::text));

-- AUDIT_LOG
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admins can see all audit logs" ON public.audit_log AS PERMISSIVE FOR SELECT TO public USING (((current_user_role())::text = 'super_admin'::text));

-- SYSTEM_CONFIG
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read system_config" ON public.system_config AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Super Admins can manage system_config" ON public.system_config AS PERMISSIVE FOR ALL TO public USING (((current_user_role())::text = 'super_admin'::text));

-- MOVIMIENTOS_CARTERA
ALTER TABLE public.movimientos_cartera ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins ver movimientos de sus carteras" ON public.movimientos_cartera AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM carteras c WHERE ((c.id = movimientos_cartera.cartera_id) AND (c.admin_id = auth.uid())))));
