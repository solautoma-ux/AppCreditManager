-- MIGRATION: 188_dynamic_timezone_status.sql
-- Description: Actualiza la función check_and_update_credit_statuses para
-- recibir la zona horaria del cliente. Esto previene que los créditos pasen
-- a estado "vencido" prematuramente debido a la diferencia horaria entre el
-- servidor UTC y el cliente local.

CREATE OR REPLACE FUNCTION check_and_update_credit_statuses(p_timezone text DEFAULT 'UTC')
RETURNS void AS $$
DECLARE
    int_vencidosCount INTEGER;
    int_pagadosCount INTEGER;
BEGIN
    -- 1. Actualizar a 'vencido' los créditos activos cuya fecha de vencimiento ya pasó
    -- y aún tienen saldo pendiente.
    -- Se utiliza la zona horaria pasada por parámetro para evaluar "hoy".
    UPDATE creditos
    SET estado = 'vencido',
        updated_at = CURRENT_TIMESTAMP
    WHERE estado = 'activo'
    AND fecha_vencimiento < (CURRENT_TIMESTAMP AT TIME ZONE p_timezone)::DATE
    AND (saldo_capital_pendiente > 0 OR saldo_interes_pendiente > 0);

    GET DIAGNOSTICS int_vencidosCount = ROW_COUNT;

    -- 2. Actualizar a 'pagado' los créditos que tienen saldo 0 
    -- (por si alguno quedó en estado activo/vencido erroneamente)
    UPDATE creditos
    SET estado = 'pagado',
        updated_at = CURRENT_TIMESTAMP
    WHERE estado IN ('activo', 'vencido')
    AND saldo_capital_pendiente <= 0 
    AND saldo_interes_pendiente <= 0;

    GET DIAGNOSTICS int_pagadosCount = ROW_COUNT;

    -- Loguear si hubo cambios
    IF int_vencidosCount > 0 OR int_pagadosCount > 0 THEN
        RAISE NOTICE 'Actualización automática: % pasaron a Vencido, % pasaron a Pagado, TZ: %', int_vencidosCount, int_pagadosCount, p_timezone;
    END IF;
END;
$$ LANGUAGE plpgsql;
