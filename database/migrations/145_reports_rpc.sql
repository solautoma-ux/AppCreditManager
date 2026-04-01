-- Migration: Reports Module Functions
-- Description: RPCs for financial reporting and dashboard charts.

-- 1. KPI Financieros (Resumen por periodo)
-- Calcula: Total Prestado, Total Recaudado (Capital + Interés), Ganancia (Interés)
CREATE OR REPLACE FUNCTION public.get_kpis_financieros(
    p_fecha_inicio DATE, 
    p_fecha_fin DATE, 
    p_cartera_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_prestado NUMERIC;
    v_total_recaudado NUMERIC;
    v_total_ganancia NUMERIC;
    v_indice_mora NUMERIC;
BEGIN
    -- 1. Total Prestado (Suma capital de nuevos créditos en el rango)
    SELECT COALESCE(SUM(monto_capital), 0)
    INTO v_total_prestado
    FROM public.creditos
    WHERE created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_cartera_id IS NULL OR cartera_id = p_cartera_id)
    AND estado != 'cancelado'; -- Ignorar cancelados

    -- 2. Total Recaudado y Ganancia (Desde pagos)
    SELECT 
        COALESCE(SUM(p.monto_total), 0),
        COALESCE(SUM(p.monto_a_interes), 0)
    INTO v_total_recaudado, v_total_ganancia
    FROM public.pagos p
    JOIN public.creditos c ON p.credito_id = c.id
    WHERE p.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id);

    -- 3. Índice de Mora Actual (Snapshot al momento de la consulta)
    -- (Saldo vencido / Saldo total cartera) * 100
    WITH saldos AS (
        SELECT 
            COALESCE(SUM(saldo_capital_pendiente), 0) as total,
            COALESCE(SUM(CASE WHEN estado = 'vencido' THEN saldo_capital_pendiente ELSE 0 END), 0) as vencido
        FROM public.creditos
        WHERE estado IN ('activo', 'vencido')
        AND (p_cartera_id IS NULL OR cartera_id = p_cartera_id)
    )
    SELECT CASE WHEN total > 0 THEN (vencido / total) * 100 ELSE 0 END
    INTO v_indice_mora
    FROM saldos;

    RETURN jsonb_build_object(
        'total_prestado', v_total_prestado,
        'total_recaudado', v_total_recaudado,
        'ganancia_bruta', v_total_ganancia,
        'indice_mora', ROUND(v_indice_mora, 2)
    );
END;
$$;

-- 2. Movimientos para Gráficos (Tendencia Diaria)
-- Retorna array con: { fecha, prestado, recaudado }
CREATE OR REPLACE FUNCTION public.get_grafico_flujo_caja(
    p_fecha_inicio DATE, 
    p_fecha_fin DATE, 
    p_cartera_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(t)
    INTO v_result
    FROM (
        SELECT 
            d.dia::DATE as fecha,
            COALESCE(prestamos.total, 0) as prestado,
            COALESCE(pagos.total, 0) as recaudado
        FROM generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval) d(dia)
        LEFT JOIN (
            SELECT created_at::DATE as fecha, SUM(monto_capital) as total
            FROM public.creditos
            WHERE (p_cartera_id IS NULL OR cartera_id = p_cartera_id)
            AND estado != 'cancelado'
            GROUP BY 1
        ) prestamos ON prestamos.fecha = d.dia::DATE
        LEFT JOIN (
            SELECT p.created_at::DATE as fecha, SUM(p.monto_total) as total
            FROM public.pagos p
            JOIN public.creditos c ON p.credito_id = c.id
            WHERE (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
            GROUP BY 1
        ) pagos ON pagos.fecha = d.dia::DATE
        ORDER BY d.dia
    ) t;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- 3. Distribución de Cartera (Donut Chart)
CREATE OR REPLACE FUNCTION public.get_distribucion_cartera(
    p_cartera_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(t)
    INTO v_result
    FROM (
        SELECT 
            estado,
            COUNT(*) as cantidad,
            SUM(saldo_capital_pendiente) as saldo_total
        FROM public.creditos
        WHERE estado IN ('activo', 'vencido', 'pagado', 'judicial')
        AND (p_cartera_id IS NULL OR cartera_id = p_cartera_id)
        GROUP BY estado
    ) t;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;
