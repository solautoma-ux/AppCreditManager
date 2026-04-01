-- Función para actualizar estados de créditos automáticamente
-- 1. Marcar como VENCIDO si ya pasó la fecha final y tiene saldo pendiente
-- 2. Marcar como PAGADO si ya no tiene saldo pendiente

CREATE OR REPLACE FUNCTION check_and_update_credit_statuses()
RETURNS void AS $$
DECLARE
    vencidos_count INTEGER;
    pagados_count INTEGER;
BEGIN
    -- 1. Actualizar a 'vencido' los créditos activos cuya fecha de vencimiento ya pasó
    -- y aún tienen saldo pendiente.
    UPDATE creditos
    SET estado = 'vencido',
        updated_at = CURRENT_TIMESTAMP
    WHERE estado = 'activo'
    AND fecha_vencimiento < CURRENT_DATE
    AND (saldo_capital_pendiente > 0 OR saldo_interes_pendiente > 0);

    GET DIAGNOSTICS vencidos_count = ROW_COUNT;

    -- 2. Actualizar a 'pagado' los créditos que tienen saldo 0 
    -- (por si alguno quedó en estado activo/vencido erroneamente)
    UPDATE creditos
    SET estado = 'pagado',
        updated_at = CURRENT_TIMESTAMP
    WHERE estado IN ('activo', 'vencido')
    AND saldo_capital_pendiente <= 0 
    AND saldo_interes_pendiente <= 0;

    GET DIAGNOSTICS pagados_count = ROW_COUNT;

    -- Opcional: Loguear si hubo cambios (solo para debug, se puede quitar)
    IF vencidos_count > 0 OR pagados_count > 0 THEN
        RAISE NOTICE 'Actualización automática: % pasaron a Vencido, % pasaron a Pagado', vencidos_count, pagados_count;
    END IF;
END;
$$ LANGUAGE plpgsql;
