-- Migration: 160_detailed_reports_rpc
-- Description: Adds RPCs for detailed tabular reports with role-based filtering.

-- 1. Reporte de Morosidad Detallado
CREATE OR REPLACE FUNCTION public.get_reporte_morosidad_detallado(
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
            c.codigo as codigo_prestamo,
            cl.nombre || ' ' || cl.apellido as cliente_nombre,
            cl.movil as cliente_movil,
            w.nombre as cartera_nombre,
            c.saldo_capital_pendiente as capital_pendiente,
            c.saldo_interes_pendiente as interes_pendiente,
            (c.saldo_capital_pendiente + c.saldo_interes_pendiente) as saldo_total,
            CURRENT_DATE - c.fecha_vencimiento as dias_atraso
        FROM public.creditos c
        JOIN public.clientes cl ON c.cliente_id = cl.id
        JOIN public.carteras w ON c.cartera_id = w.id
        WHERE c.estado = 'vencido'
        AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
        AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
        AND (p_encargado_id IS NULL OR EXISTS (
            SELECT 1 FROM public.cartera_encargados ce 
            WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
        ))
        ORDER BY dias_atraso DESC
    ) t;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- 2. Reporte de Movimientos Detallados
CREATE OR REPLACE FUNCTION public.get_reporte_movimientos_detallados(
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
        -- Desembolsos (Creación de créditos)
        SELECT 
            c.created_at as fecha_hora,
            c.created_at::DATE as fecha,
            'Desembolso' as tipo,
            c.monto_capital as monto,
            c.codigo as codigo_prestamo,
            cl.nombre || ' ' || cl.apellido as cliente_nombre,
            w.nombre as cartera_nombre
        FROM public.creditos c
        JOIN public.clientes cl ON c.cliente_id = cl.id
        JOIN public.carteras w ON c.cartera_id = w.id
        WHERE c.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
        AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
        AND (p_encargado_id IS NULL OR EXISTS (
            SELECT 1 FROM public.cartera_encargados ce 
            WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
        ))
        AND c.estado != 'cancelado'

        UNION ALL

        -- Recaudos (Pagos realizados)
        SELECT 
            p.created_at as fecha_hora,
            p.created_at::DATE as fecha,
            'Recaudo' as tipo,
            p.monto_total as monto,
            c.codigo as codigo_prestamo,
            cl.nombre || ' ' || cl.apellido as cliente_nombre,
            w.nombre as cartera_nombre
        FROM public.pagos p
        JOIN public.creditos c ON p.credito_id = c.id
        JOIN public.clientes cl ON c.cliente_id = cl.id
        JOIN public.carteras w ON c.cartera_id = w.id
        WHERE p.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
        AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
        AND (p_encargado_id IS NULL OR EXISTS (
            SELECT 1 FROM public.cartera_encargados ce 
            WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
        ))

        ORDER BY fecha_hora DESC
    ) t;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.get_reporte_morosidad_detallado TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reporte_movimientos_detallados TO authenticated;
