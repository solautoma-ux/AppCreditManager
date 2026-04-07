-- 180_seed_subscriptions_for_existing_admins.sql
-- Crear registros de suscripción por defecto para todos los admins activos 
-- que no tengan uno. Esto resuelve el "N/A" en el frontend de staging.

INSERT INTO public.admin_subscriptions (
    admin_id,
    tipo_plan,
    monto_mensual,
    fecha_inicio_suscripcion,
    fecha_proximo_pago,
    estado_suscripcion,
    dias_mora,
    total_pagado
)
SELECT 
    u.id,
    'mensual',                                            -- Plan por defecto
    50000,                                                -- Monto por defecto
    CURRENT_DATE,                                         -- Inicio: hoy
    CURRENT_DATE + INTERVAL '30 days',                   -- Vencimiento: 30 días
    'activa',
    0,
    0
FROM public.usuarios u
WHERE 
    u.rol = 'admin'
    AND NOT EXISTS (
        SELECT 1 FROM public.admin_subscriptions s 
        WHERE s.admin_id = u.id
    );
