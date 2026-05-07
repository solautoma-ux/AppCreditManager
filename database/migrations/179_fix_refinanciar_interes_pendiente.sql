-- MIGRATION: 179_fix_refinanciar_interes_pendiente.sql
-- Description: Corrige el cálculo del saldo_actual de la cartera al refinanciar un crédito.
--
-- PROBLEMA ORIGINAL:
--   Al refinanciar, la función solo devolvía el saldo_capital_pendiente del crédito viejo
--   a la cartera (v_old_saldo_capital). El saldo_interes_pendiente del crédito original
--   era ignorado, por lo que ese interés ganado se "evaporaba" sin registrarse como ingreso
--   de la cartera. Esto provocaba que la Utilidad Disponible no reflejara el interés del
--   crédito original que fue absorbido en el capital del crédito refinanciado.
--
-- EJEMPLO DEL ERROR:
--   Crédito original: $1.000.000 capital + $200.000 interés (total deuda $1.200.000)
--   Se refinancia por $1.200.000 al 10% → nuevo interés $120.000 → total $1.320.000
--   Al pagar el nuevo crédito la cartera mostraba utilidad de $120.000 (solo interés nuevo)
--   en lugar de $320.000 ($200.000 interés original + $120.000 interés nuevo).
--
-- CORRECCIÓN:
--   Se suma también el saldo_interes_pendiente del crédito original al saldo_actual,
--   reconociéndolo como ingreso financiero en el momento de la refinanciación, ya que
--   ese interés fue efectivamente capitalizado en el nuevo principal.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refinanciar_credito(
    p_credito_id UUID,
    p_admin_id UUID,
    p_cartera_id UUID,
    p_monto_capital DECIMAL,
    p_tasa_interes DECIMAL,
    p_monto_interes_calculado DECIMAL,
    p_monto_total DECIMAL,
    p_plazo_numero INTEGER,
    p_plazo_unidad VARCHAR,
    p_frecuencia_pago VARCHAR,
    p_numero_cuotas INTEGER,
    p_monto_cuota DECIMAL,
    p_fecha_inicio DATE,
    p_fecha_vencimiento DATE,
    p_cuotas_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_nuevo_credito_id     UUID;
    v_old_saldo_capital    DECIMAL;
    v_old_saldo_interes    DECIMAL;
    v_codigo_credito       VARCHAR;
    v_cliente_id           UUID;
    -- Total devuelto a la cartera = capital pendiente + interés pendiente del crédito original.
    -- El interés pendiente se reconoce como ingreso porque fue capitalizado en el nuevo préstamo.
    v_total_devuelto       DECIMAL;
BEGIN
    -- 1. Obtener datos del crédito viejo (capital E interés pendientes)
    SELECT saldo_capital_pendiente, saldo_interes_pendiente, cliente_id
    INTO v_old_saldo_capital, v_old_saldo_interes, v_cliente_id
    FROM public.creditos
    WHERE id = p_credito_id AND admin_id = p_admin_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédito no encontrado o no pertenece al admin';
    END IF;

    -- 2. Cerrar el crédito original marcándolo como 'refinanciado'
    UPDATE public.creditos
    SET estado                 = 'refinanciado',
        saldo_capital_pendiente = 0,
        saldo_interes_pendiente = 0,
        updated_at              = NOW()
    WHERE id = p_credito_id;

    -- 3. Generar código para el nuevo crédito
    v_codigo_credito := 'CR-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0') || '-' || TO_CHAR(NOW(), 'MMDD');

    -- 4. Crear el nuevo crédito refinanciado
    INSERT INTO public.creditos (
        admin_id, cartera_id, cliente_id, codigo, creado_por_id,
        monto_capital, tasa_interes, monto_interes_calculado, monto_total,
        plazo_numero, plazo_unidad, frecuencia_pago, numero_cuotas, monto_cuota,
        fecha_inicio, fecha_vencimiento, fecha_proximo_pago,
        saldo_capital_pendiente, saldo_interes_pendiente,
        estado, credito_padre_id
    ) VALUES (
        p_admin_id, p_cartera_id, v_cliente_id, v_codigo_credito, p_admin_id,
        p_monto_capital, p_tasa_interes, p_monto_interes_calculado, p_monto_total,
        p_plazo_numero, p_plazo_unidad, p_frecuencia_pago, p_numero_cuotas, p_monto_cuota,
        p_fecha_inicio, p_fecha_vencimiento, (p_cuotas_json->0->>'fecha_vencimiento')::DATE,
        p_monto_capital, p_monto_interes_calculado,
        'activo', p_credito_id
    )
    RETURNING id INTO v_nuevo_credito_id;

    -- 5. Crear el plan de amortización del nuevo crédito
    INSERT INTO public.amortizaciones (
        credito_id, numero_cuota, fecha_vencimiento,
        monto_cuota, capital_cuota, interes_cuota, saldo_pendiente, estado
    )
    SELECT
        v_nuevo_credito_id,
        (cuota->>'numero')::INTEGER,
        (cuota->>'fecha_vencimiento')::DATE,
        (cuota->>'monto_cuota')::DECIMAL,
        (cuota->>'capital')::DECIMAL,
        (cuota->>'interes')::DECIMAL,
        (cuota->>'monto_cuota')::DECIMAL,
        'pendiente'
    FROM jsonb_array_elements(p_cuotas_json) AS cuota;

    -- 6. Actualizar contador de refinanciamientos del cliente
    UPDATE public.clientes
    SET total_refinanciamientos = COALESCE(total_refinanciamientos, 0) + 1,
        updated_at              = NOW()
    WHERE id = v_cliente_id;

    -- 7. Actualizar el saldo de la cartera.
    --    FIX: Se suma tanto el capital como el INTERÉS pendiente del crédito original
    --    porque ese interés fue capitalizado (incluido) en el nuevo monto prestado.
    --    De no hacerlo, la utilidad generada por el crédito original se pierde.
    --
    --    Fórmula:
    --      saldo_actual += (v_old_saldo_capital + v_old_saldo_interes) - p_monto_capital
    --
    --    Desglose:
    --      + v_old_saldo_capital : capital del crédito viejo que "regresa"
    --      + v_old_saldo_interes : interés del crédito viejo reconocido como ingreso
    --      - p_monto_capital     : capital del nuevo crédito que sale de la caja
    v_total_devuelto := v_old_saldo_capital + v_old_saldo_interes;

    UPDATE public.carteras
    SET saldo_actual = saldo_actual + v_total_devuelto - p_monto_capital,
        updated_at   = NOW()
    WHERE id = p_cartera_id;

    RETURN jsonb_build_object(
        'success',        true,
        'old_credito_id', p_credito_id,
        'new_credito_id', v_nuevo_credito_id,
        'codigo',         v_codigo_credito
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refinanciar_credito TO authenticated;
