-- Migration: 152_reports_role_filtering
-- Description: Updates report RPCs to filter by admin_id OR encargado_id based on user role.
-- Logic:
--   - Encargado: Only sees data from carteras assigned to them (via cartera_encargados)
--   - Admin: Sees data from their own carteras (admin_id match)
--   - Super Admin: Sees everything

-- DROP OLD FUNCTION SIGNATURES
DROP FUNCTION IF EXISTS public.get_kpis_financieros(DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.get_kpis_financieros(DATE, DATE, UUID, UUID);
DROP FUNCTION IF EXISTS public.get_kpis_financieros(DATE, DATE, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.get_grafico_flujo_caja(DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.get_grafico_flujo_caja(DATE, DATE, UUID, UUID);
DROP FUNCTION IF EXISTS public.get_grafico_flujo_caja(DATE, DATE, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.get_distribucion_cartera(UUID);
DROP FUNCTION IF EXISTS public.get_distribucion_cartera(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_distribucion_cartera(UUID, UUID, UUID);

-- 1. KPI Financieros (Resumen por periodo) - WITH ROLE FILTERING
CREATE OR REPLACE FUNCTION public.get_kpis_financieros(
    p_fecha_inicio DATE, 
    p_fecha_fin DATE, 
    p_cartera_id UUID DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL,
    p_encargado_id UUID DEFAULT NULL  -- NEW: For encargado filtering
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

    -- 2. Total Recaudado y Ganancia (Desde pagos)
    SELECT 
        COALESCE(SUM(p.monto_total), 0),
        COALESCE(SUM(p.monto_a_interes), 0)
    INTO v_total_recaudado, v_total_ganancia
    FROM public.pagos p
    JOIN public.creditos c ON p.credito_id = c.id
    JOIN public.carteras w ON c.cartera_id = w.id
    WHERE p.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
    AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
    AND (p_encargado_id IS NULL OR EXISTS (
        SELECT 1 FROM public.cartera_encargados ce 
        WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
    ));

    -- 3. Índice de Mora Actual (Snapshot al momento de la consulta)
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

    RETURN jsonb_build_object(
        'total_prestado', v_total_prestado,
        'total_recaudado', v_total_recaudado,
        'ganancia_bruta', v_total_ganancia,
        'indice_mora', ROUND(v_indice_mora, 2)
    );
END;
$$;

-- 2. Flujo de Caja (Tendencia Diaria) - WITH ROLE FILTERING
CREATE OR REPLACE FUNCTION public.get_grafico_flujo_caja(
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
            SELECT c.created_at::DATE as fecha, SUM(c.monto_capital) as total
            FROM public.creditos c
            JOIN public.carteras w ON c.cartera_id = w.id
            WHERE (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
            AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
            AND (p_encargado_id IS NULL OR EXISTS (
                SELECT 1 FROM public.cartera_encargados ce 
                WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
            ))
            AND c.estado != 'cancelado'
            GROUP BY 1
        ) prestamos ON prestamos.fecha = d.dia::DATE
        LEFT JOIN (
            SELECT p.created_at::DATE as fecha, SUM(p.monto_total) as total
            FROM public.pagos p
            JOIN public.creditos c ON p.credito_id = c.id
            JOIN public.carteras w ON c.cartera_id = w.id
            WHERE (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
            AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
            AND (p_encargado_id IS NULL OR EXISTS (
                SELECT 1 FROM public.cartera_encargados ce 
                WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
            ))
            GROUP BY 1
        ) pagos ON pagos.fecha = d.dia::DATE
        ORDER BY d.dia
    ) t;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- 3. Distribución de Cartera (Donut Chart) - WITH ROLE FILTERING
CREATE OR REPLACE FUNCTION public.get_distribucion_cartera(
    p_cartera_id UUID DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL,
    p_encargado_id UUID DEFAULT NULL
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
            c.estado,
            COUNT(*) as cantidad,
            SUM(c.saldo_capital_pendiente) as saldo_total
        FROM public.creditos c
        JOIN public.carteras w ON c.cartera_id = w.id
        WHERE c.estado IN ('activo', 'vencido', 'pagado', 'judicial')
        AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
        AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
        AND (p_encargado_id IS NULL OR EXISTS (
            SELECT 1 FROM public.cartera_encargados ce 
            WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
        ))
        GROUP BY c.estado
    ) t;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_kpis_financieros TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grafico_flujo_caja TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distribucion_cartera TO authenticated;
