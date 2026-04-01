-- Migración: Agregar columna tipo_plan a admin_subscriptions
-- Fecha: 2026-02-09
-- Descripción: Agrega la columna tipo_plan (mensual, anual, prueba_gratis) 
--              que se usa en el frontend pero no existe en la BD

-- Agregar columna tipo_plan con valores permitidos
ALTER TABLE public.admin_subscriptions
ADD COLUMN tipo_plan VARCHAR(20) DEFAULT 'mensual' CHECK (tipo_plan IN ('mensual', 'anual', 'prueba_gratis'));

-- Comentario descriptivo
COMMENT ON COLUMN public.admin_subscriptions.tipo_plan IS 'Tipo de plan de suscripción: mensual (30 días), anual (365 días), o prueba_gratis (30 días gratis)';
