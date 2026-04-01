-- MIGRATION: 173_prune_audit_logs_rpc.sql
-- DESCRIPTION: Función RPC para limpiar logs antiguos y mantener la tabla liviana
-- PARAM: p_days_to_keep (INT) - Días de historial a conservar (ej. 30, 60, 90)

CREATE OR REPLACE FUNCTION public.prune_audit_logs(p_days_to_keep INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Requiere permisos elevados para borrar
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    -- Validación de seguridad básica: p_days_to_keep debe ser al menos 1
    IF p_days_to_keep < 1 THEN
        RETURN jsonb_build_object('success', false, 'message', 'El periodo de retención debe ser al menos 1 día');
    END IF;

    -- Ejecutar limpieza
    -- Asumimos que la columna de fecha es 'created_at'. 
    -- Si falla por nombre de columna, el error lo indicará.
    WITH deleted_rows AS (
        DELETE FROM public.audit_log
        WHERE created_at < (NOW() - (p_days_to_keep || ' days')::INTERVAL)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted_rows;

    RETURN jsonb_build_object(
        'success', true, 
        'message', format('Se han eliminado %s registros antiguos.', v_deleted_count),
        'deleted_count', v_deleted_count
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.prune_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.prune_audit_logs TO service_role;
