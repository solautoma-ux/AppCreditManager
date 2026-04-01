-- MIGRATION: 178_fix_movimientos_incluir_retiros.sql
-- Description: Actualiza get_reporte_movimientos_detallados para:
--   1. Excluir registros negativos (reversos contables del sistema Deshacer Pago)
--      de la lista de Recaudos para que no aparezcan como movimientos con signo negativo.
--   2. Agregar un tercer bloque UNION ALL con los retiros de utilidad registrados
--      en movimientos_cartera (tipo_movimiento = 'retiro_utilidad') para que
--      aparezcan en la tabla como tipo 'Retiro Utilidad', igual que Recaudo y Desembolso.
-- ============================================================================

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
        -- Bloque 1: Desembolsos (Creación de créditos)
        SELECT
            c.created_at          AS fecha_hora,
            c.created_at::DATE    AS fecha,
            'Desembolso'          AS tipo,
            c.monto_capital       AS monto,
            c.codigo              AS codigo_prestamo,
            cl.nombre || ' ' || cl.apellido AS cliente_nombre,
            w.nombre              AS cartera_nombre
        FROM public.creditos c
        JOIN public.clientes cl ON c.cliente_id = cl.id
        JOIN public.carteras w  ON c.cartera_id = w.id
        WHERE c.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
        AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
        AND (p_encargado_id IS NULL OR EXISTS (
            SELECT 1 FROM public.cartera_encargados ce
            WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
        ))
        AND c.estado != 'cancelado'

        UNION ALL

        -- Bloque 2: Recaudos (Pagos realizados, excluyendo reversos negativos del LIFO)
        SELECT
            p.created_at          AS fecha_hora,
            p.created_at::DATE    AS fecha,
            'Recaudo'             AS tipo,
            p.monto_total         AS monto,
            c.codigo              AS codigo_prestamo,
            cl.nombre || ' ' || cl.apellido AS cliente_nombre,
            w.nombre              AS cartera_nombre
        FROM public.pagos p
        JOIN public.creditos c  ON p.credito_id = c.id
        JOIN public.clientes cl ON c.cliente_id = cl.id
        JOIN public.carteras w  ON c.cartera_id = w.id
        WHERE p.created_at::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
        AND p.monto_total > 0   -- Excluir reversos contables (negativos del sistema Deshacer Pago)
        AND (p_cartera_id IS NULL OR c.cartera_id = p_cartera_id)
        AND (p_admin_id IS NULL OR w.admin_id = p_admin_id)
        AND (p_encargado_id IS NULL OR EXISTS (
            SELECT 1 FROM public.cartera_encargados ce
            WHERE ce.cartera_id = w.id AND ce.encargado_id = p_encargado_id
        ))

        UNION ALL

        -- Bloque 3: Retiros de Utilidad (movimientos_cartera tipo retiro_utilidad)
        --           Se muestran con campos cliente_nombre y codigo_prestamo vacíos
        --           ya que son movimientos a nivel de cartera, no de crédito individual.
        SELECT
            m.fecha               AS fecha_hora,
            m.fecha::DATE         AS fecha,
            'Retiro Utilidad'     AS tipo,
            m.monto               AS monto,
            ''                    AS codigo_prestamo,
            COALESCE(m.notas, 'Retiro de utilidad') AS cliente_nombre,
            w.nombre              AS cartera_nombre
        FROM public.movimientos_cartera m
        JOIN public.carteras w ON m.cartera_id = w.id
        WHERE m.tipo_movimiento = 'retiro_utilidad'
        AND m.fecha::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (p_cartera_id IS NULL OR m.cartera_id = p_cartera_id)
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

GRANT EXECUTE ON FUNCTION public.get_reporte_movimientos_detallados TO authenticated;
