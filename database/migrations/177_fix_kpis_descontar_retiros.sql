-- MIGRATION: 177_fix_kpis_descontar_retiros.sql
-- Description: Corrige la función get_kpis_financieros para:
--   1. Ignorar pagos negativos (reversos contables) en el cálculo de
--      Total Recaudado y Ganancia Bruta (monto_total > 0).
--   2. Incluir un nuevo KPI "total_retirado" que suma todos los retiros
--      de rentabilidad registrados en la tabla movimientos_cartera.
--   3. Agregar un KPI "saldo_neto_ganancia" = ganancia_bruta - total_retirado
--      para mostrar cuánta rentabilidad queda disponible sin retirar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_kpis_financieros(
    p_fecha_inicio DATE,
    p_fecha_fin DATE,
    p_cartera_id UUID DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL,
    p_encargado_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_prestado  NUMERIC;
    v_total_recaudado NUMERIC;
    v_total_ganancia  NUMERIC;
    v_indice_mora     NUMERIC;
    v_total_retirado  NUMERIC;
BEGIN
    -- 1. Total Prestado (capital de nuevos créditos en el rango de fechas)
    SELECT COALESCE(SUM(c.monto_capital), 0)
    INTO v_total_prestado
    FROM public.creditos c
    JOIN public.carteras w ON c.cartera_id = w.id
    WHERE c.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
    AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
    AND (p_encargado_id IS NULL OR EXISTS (
        SELECT 1 FROM public.cartera_encargados ce
        WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
    ))
    AND c.estado != 'cancelado';

    -- 2. Total Recaudado y Ganancia Bruta.
    --    Se filtra monto_total > 0 para excluir los registros negativos de reverso
    --    contable insertados por la función deshacer_pago.
    SELECT
        COALESCE(SUM(p.monto_total), 0),
        COALESCE(SUM(p.monto_a_interes), 0)
    INTO v_total_recaudado, v_total_ganancia
    FROM public.pagos p
    JOIN public.creditos c ON p.credito_id = c.id
    JOIN public.carteras w ON c.cartera_id = w.id
    WHERE p.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    AND p.monto_total > 0   -- Excluir reversos contables (negativos del LIFO)
    AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
    AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
    AND (p_encargado_id IS NULL OR EXISTS (
        SELECT 1 FROM public.cartera_encargados ce
        WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
    ));

    -- 3. Total Retirado: suma de todos los retiros de utilidad del período.
    --    Los retiros se registran en movimientos_cartera con tipo = 'retiro_utilidad'.
    --    Esto permite mostrar cuánta rentabilidad ya fue retirada por el administrador
    --    sin mezclarla con el saldo de la cartera ni con los recaudos de préstamos.
    SELECT COALESCE(SUM(m.monto), 0)
    INTO v_total_retirado
    FROM public.movimientos_cartera m
    JOIN public.carteras w ON m.cartera_id = w.id
    WHERE m.tipo_movimiento = 'retiro_utilidad'
    AND m.fecha::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_cartera_id IS NULL OR m.cartera_id = p_cartera_id)
    AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
    AND (p_encargado_id IS NULL OR EXISTS (
        SELECT 1 FROM public.cartera_encargados ce
        WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
    ));

    -- 4. Índice de Mora Actual (snapshot al momento de la consulta, no depende del rango de fechas)
    WITH saldos AS (
        SELECT
            COALESCE(SUM(c.saldo_capital_pendiente), 0) as total,
            COALESCE(SUM(CASE WHEN c.estado = 'vencido' THEN c.saldo_capital_pendiente ELSE 0 END), 0) as vencido
        FROM public.creditos c
        JOIN public.carteras w ON c.cartera_id = w.id
        WHERE c.estado IN ('activo', 'vencido')
        AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
        AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
        AND (p_encargado_id IS NULL OR EXISTS (
            SELECT 1 FROM public.cartera_encargados ce
            WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
        ))
    )
    SELECT CASE WHEN total > 0 THEN (vencido / total) * 100 ELSE 0 END
    INTO v_indice_mora
    FROM saldos;

    -- Retornar todos los KPIs incluyendo los nuevos de retiro
    RETURN jsonb_build_object(
        'total_prestado',    v_total_prestado,
        'total_recaudado',   v_total_recaudado,
        'ganancia_bruta',    v_total_ganancia,
        'total_retirado',    v_total_retirado,
        'ganancia_neta',     GREATEST(0, v_total_ganancia - v_total_retirado),
        'indice_mora',       ROUND(v_indice_mora, 2)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kpis_financieros TO authenticated;
