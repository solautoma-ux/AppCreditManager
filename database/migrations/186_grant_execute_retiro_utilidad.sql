-- Migration: 186_grant_execute_retiro_utilidad.sql
-- Description: Otorga permisos de ejecución al rol authenticated para la función retirar_utilidad_cartera
-- Esto es necesario porque el frontend (y ahora el backend a través del cliente scoped con JWT)
-- accede a esta función con el rol authenticated.

GRANT EXECUTE ON FUNCTION public.retirar_utilidad_cartera(UUID, DECIMAL, TEXT) TO authenticated;
