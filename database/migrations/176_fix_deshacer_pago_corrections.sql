-- MIGRATION: 176_fix_deshacer_pago_corrections.sql
-- Description: Corrective migration for 175_deshacer_pagos_rpc.sql.
--              Applies 3 incremental fixes discovered during QA testing:
--
--   FIX 1: Replace invalid status 'vencida' with 'mora' when restoring
--           amortization installments. The amortizaciones_estado_check
--           constraint only allows: 'pendiente','parcial','pagada','mora','liquidada'.
--
--   FIX 2: Prevent infinite reversals on the same payment by tagging the
--           original payment row with suffix ' (Reversado)' after processing.
--           The LIFO validator now excludes rows containing '(Reversado)'.
--
--   FIX 3: Reinforce the final 'mora' state sweep for overdue installments
--           (was previously using 'vencida' which violated the constraint).
--
-- NOTE: This migration is idempotent — safe to re-run.
-- ============================================================================

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
    --    FIX 2: Excluir pagos ya marcados con '(Reversado)' para prevenir reversos infinitos
    SELECT id INTO v_ultimo_pago_id
    FROM public.pagos
    WHERE credito_id = v_credito.id
      AND monto_total > 0
      AND notas NOT LIKE 'REVERSADO:%'
      AND notas NOT LIKE '%(Reversado)%'
    ORDER BY created_at DESC LIMIT 1;

    IF v_ultimo_pago_id != p_pago_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo puedes deshacer el último pago registrado para mantener la integridad de las cuotas.');
    END IF;

    -- 5. Obtener cartera
    SELECT * INTO v_cartera FROM public.carteras WHERE id = v_credito.cartera_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Cartera no encontrada'); END IF;

    -- 6. Restaurar saldos del crédito
    UPDATE public.creditos
    SET saldo_capital_pendiente = saldo_capital_pendiente + v_pago.monto_a_capital,
        saldo_interes_pendiente = saldo_interes_pendiente + v_pago.monto_a_interes,
        estado = CASE
            WHEN estado = 'pagado' THEN 'activo'
            ELSE estado
        END,
        updated_at = NOW()
    WHERE id = v_credito.id;

    -- Determinar nuevo estado del crédito para el retorno
    SELECT estado INTO v_nuevo_estado FROM public.creditos WHERE id = v_credito.id;

    -- 7. Restaurar saldo de la cartera (revertir los fondos que entraron)
    UPDATE public.carteras
    SET saldo_actual   = saldo_actual - (v_pago.monto_a_capital + v_pago.monto_a_interes),
        saldo_prestado = saldo_prestado + v_pago.monto_a_capital,
        updated_at     = NOW()
    WHERE id = v_cartera.id;

    -- 8. Restaurar amortizaciones (waterfall inverso)
    v_monto_restaurar := v_pago.monto_total;

    FOR v_amortizacion IN
        SELECT * FROM public.amortizaciones
        WHERE credito_id = v_credito.id AND estado IN ('pagada', 'parcial')
        ORDER BY numero_cuota DESC
    LOOP
        IF v_monto_restaurar <= 0 THEN EXIT; END IF;

        v_monto_aplicar := LEAST(v_monto_restaurar, (v_amortizacion.monto_cuota - v_amortizacion.saldo_pendiente));

        IF v_monto_aplicar > 0 THEN
            UPDATE public.amortizaciones
            SET saldo_pendiente = saldo_pendiente + v_monto_aplicar,
                estado = CASE
                    -- FIX 1: Usar 'mora' en lugar de 'vencida' para cumplir amortizaciones_estado_check
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

    -- FIX 3: Barrido final — cuotas que regresaron a 'pendiente' pero están vencidas deben ser 'mora'
    UPDATE public.amortizaciones
    SET estado = 'mora'
    WHERE credito_id = v_credito.id
      AND estado = 'pendiente'
      AND fecha_vencimiento < CURRENT_DATE;

    -- 9. Registrar el reverso contable en tabla pagos (monto negativo = doble entrada)
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

    -- FIX 2: Marcar el pago original para que no pueda reversarse de nuevo (anti-loop)
    UPDATE public.pagos SET notas = notas || ' (Reversado)' WHERE id = v_pago.id;

    RETURN jsonb_build_object('success', true, 'nuevo_estado', v_nuevo_estado, 'pago_reverso_id', v_nuevo_pago_id);
END;
$$;
