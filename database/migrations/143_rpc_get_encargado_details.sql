-- MIGRATION: 143_rpc_get_encargado_details.sql
-- Description: RPC to get detailed portfolio info for an encargado efficiently

CREATE OR REPLACE FUNCTION public.get_carteras_asignadas_detalle(p_encargado_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', c.id,
            'nombre', c.nombre,
            'codigo', c.codigo,
            'saldo_inicial', c.monto_inicial, -- Corregido: monto_inicial
            'saldo_actual', c.saldo_actual, -- This is the cached available balance
            'estado', c.estado,
            'totalPrestado', COALESCE((
                SELECT SUM(cr.monto_capital)
                FROM public.creditos cr
                WHERE cr.cartera_id = c.id 
                AND cr.estado IN ('activo', 'vencido') -- Only active capital counts
            ), 0),
            'saldoDisponible', c.saldo_actual -- Explicit alias for frontend
        )
    )
    INTO v_result
    FROM public.cartera_encargados ce
    JOIN public.carteras c ON c.id = ce.cartera_id
    WHERE ce.encargado_id = p_encargado_id;

    -- Return empty array if null
    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_carteras_asignadas_detalle(UUID) TO authenticated;
