-- MIGRATION: 175_deshacer_pagos_rpc.sql
-- Description: Adds RPC to undo a payment (within 24 hours, LIFO rule, restoring wallet/credit/quotas).

-- Permitir montos negativos para la tabla pagos estrictamente para reversos contables
ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_monto_total_check;
ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_monto_a_capital_check;
ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_monto_a_interes_check;

CREATE OR REPLACE FUNCTION public.deshacer_pago(
    p_pago_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pago RECORD;
    v_credito RECORD;
    v_cartera RECORD;
    v_ultimo_pago_id UUID;
    v_horas_transcurridas NUMERIC;
    v_nuevo_estado VARCHAR;
    v_monto_restaurar DECIMAL;
    v_amortizacion RECORD;
    v_monto_aplicar DECIMAL;
    v_nuevo_pago_id UUID;
BEGIN
    -- 1. Obtener el pago
    SELECT * INTO v_pago FROM public.pagos WHERE id = p_pago_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pago no encontrado'); END IF;

    -- Validar que no sea ya un reverso o un pago negativo
    IF v_pago.monto_total <= 0 OR v_pago.notas LIKE 'REVERSADO:%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este pago es un reverso o tiene un monto inválido');
    END IF;

    -- 2. Validar 24 horas
    v_horas_transcurridas := EXTRACT(EPOCH FROM (NOW() - v_pago.created_at))/3600;
    IF v_horas_transcurridas > 24 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden deshacer pagos realizados en las últimas 24 horas');
    END IF;

    -- 3. Obtener el crédito y validar estado / administrador
    SELECT * INTO v_credito FROM public.creditos WHERE id = v_pago.credito_id AND admin_id = p_admin_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Crédito no encontrado o sin permisos'); END IF;

    IF v_credito.estado IN ('refinanciado', 'interrumpido') THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se puede deshacer un pago de un crédito cerrado (refinanciado o interrumpido)');
    END IF;

    -- 4. Validar regla LIFO (Debe ser el último pago positivo real)
    SELECT id INTO v_ultimo_pago_id 
    FROM public.pagos 
    WHERE credito_id = v_credito.id AND monto_total > 0 AND notas NOT LIKE 'REVERSADO:%' AND notas NOT LIKE '%(Reversado)%'
    ORDER BY created_at DESC LIMIT 1;

    IF v_ultimo_pago_id != p_pago_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Para mantener la integridad de las cuotas, solo puedes deshacer el ÚLTIMO pago realizado. (Regla LIFO de atrás hacia adelante)');
    END IF;

    -- 5. Obtener cartera y validar fondos
    SELECT * INTO v_cartera FROM public.carteras WHERE id = v_credito.cartera_id FOR UPDATE;
    
    IF v_cartera.saldo_actual < v_pago.monto_total THEN
        RETURN jsonb_build_object('success', false, 'error', 'La cartera no tiene fondos suficientes en Saldo Actual para revertir este pago. Posiblemente se retiraron utilidades.');
    END IF;

    -- 6. Restaurar saldos de Cartera (Restar de actual, Sumar a prestado)
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual - v_pago.monto_total,
        saldo_prestado = saldo_prestado + v_pago.monto_a_capital,
        updated_at = NOW()
    WHERE id = v_cartera.id;

    -- 7. Restaurar saldos de Crédito (Sumar a pendiente) y calcular Nuevo Estado
    IF v_credito.estado = 'pagado' THEN
        IF CURRENT_DATE > v_credito.fecha_vencimiento THEN
            v_nuevo_estado := 'vencido';
        ELSE
            v_nuevo_estado := 'activo';
        END IF;
    ELSE
        v_nuevo_estado := v_credito.estado; -- Dejar igual si es vencido o activo
    END IF;

    UPDATE public.creditos
    SET 
        saldo_capital_pendiente = saldo_capital_pendiente + v_pago.monto_a_capital,
        saldo_interes_pendiente = saldo_interes_pendiente + v_pago.monto_a_interes,
        estado = v_nuevo_estado,
        updated_at = NOW()
    WHERE id = v_credito.id;

    -- 8. Restaurar Cascada Amortizaciones (Llenando de abajo hacia arriba)
    v_monto_restaurar := v_pago.monto_total;

    FOR v_amortizacion IN 
        SELECT * FROM public.amortizaciones 
        WHERE credito_id = v_credito.id AND saldo_pendiente < monto_cuota
        ORDER BY numero_cuota DESC -- De atrás hacia adelante para LIFO
    LOOP
        IF v_monto_restaurar <= 0 THEN
            EXIT;
        END IF;

        -- Cuánto dinero podemos meter dentro de esta cuota? Hasta llenar `monto_cuota - saldo_pendiente`
        v_monto_aplicar := LEAST(v_monto_restaurar, v_amortizacion.monto_cuota - v_amortizacion.saldo_pendiente);
        
        IF v_monto_aplicar > 0 THEN
            UPDATE public.amortizaciones
            SET 
                saldo_pendiente = saldo_pendiente + v_monto_aplicar,
                estado = CASE 
                    WHEN (saldo_pendiente + v_monto_aplicar) >= monto_cuota THEN 'pendiente'
                    WHEN CURRENT_DATE > fecha_vencimiento AND (saldo_pendiente + v_monto_aplicar) > 0 THEN 'mora'
                    WHEN CURRENT_DATE <= fecha_vencimiento AND (saldo_pendiente + v_monto_aplicar) > 0 AND (saldo_pendiente + v_monto_aplicar) < monto_cuota THEN 'parcial'
                    ELSE 'pendiente'
                END,
                updated_at = NOW()
            WHERE id = v_amortizacion.id;

            v_monto_restaurar := v_monto_restaurar - v_monto_aplicar;
        END IF;
    END LOOP;

    -- Reforzar estados vencidos por si acaso alguna cuota regresó a 'pendiente' pero la fecha ya pasó
    UPDATE public.amortizaciones
    SET estado = 'mora'
    WHERE credito_id = v_credito.id AND estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE;

    -- 9. Invertir la operación contablemente en la tabla pagos (Insertar Negativo) y Auditar
    INSERT INTO public.audit_log (
        usuario_id, 
        accion, 
        tabla_afectada, 
        registro_id, 
        campo_modificado, 
        valor_nuevo
    )
    VALUES (
        p_admin_id, 
        'actualizar', 
        'pagos', 
        v_pago.id, 
        'estado_pago', 
        '{"estado": "reversado", "monto_reversado": ' || v_pago.monto_total || '}'
    );

    INSERT INTO public.pagos (credito_id, monto_total, monto_a_capital, monto_a_interes, fecha_pago, registrado_por_id, notas)
    VALUES (
        v_credito.id, 
        -(v_pago.monto_total), 
        -(v_pago.monto_a_capital), 
        -(v_pago.monto_a_interes), 
        CURRENT_DATE, 
        p_admin_id, 
        'REVERSADO: Pago original del ' || to_char(v_pago.fecha_pago, 'DD/MM/YYYY')
    )
    RETURNING id INTO v_nuevo_pago_id;

    -- Prevenir que este mismo pago original vuelva a ser considerado como "último pago" o deshacerse de nuevo
    UPDATE public.pagos SET notas = notas || ' (Reversado)' WHERE id = v_pago.id;

    RETURN jsonb_build_object('success', true, 'nuevo_estado', v_nuevo_estado, 'pago_reverso_id', v_nuevo_pago_id);
END;
$$;
