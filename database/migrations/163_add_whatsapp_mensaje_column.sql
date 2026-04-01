-- Migration: 163_add_whatsapp_mensaje_column.sql
-- Description: Adds custom WhatsApp message column to usuarios table for admin configuration

-- Add column to store custom WhatsApp message template
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS whatsapp_mensaje_custom TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.usuarios.whatsapp_mensaje_custom IS 'Custom message template that admins can configure to be appended to WhatsApp notifications';
