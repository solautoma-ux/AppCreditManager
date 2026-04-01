-- Migration: 155_audit_log_role_filter.sql
-- Description: Creates RPC to filter audit_log by role.
-- Super Admin: sees everything
-- Admin: sees only activities from themselves and their encargados
-- UPDATE: Includes joins to fetch readable codes (codigo, cedula) from related tables.

-- Drop first to allow return type change
DROP FUNCTION IF EXISTS public.get_audit_logs_by_role(uuid,uuid,character varying,character varying,timestamp with time zone,timestamp with time zone,integer,integer);

CREATE OR REPLACE FUNCTION public.get_audit_logs_by_role(
    p_admin_id UUID DEFAULT NULL,  -- If admin, pass their user ID
    p_usuario_filter UUID DEFAULT NULL,
    p_accion VARCHAR DEFAULT NULL,
    p_tabla VARCHAR DEFAULT NULL,
    p_fecha_desde TIMESTAMPTZ DEFAULT NULL,
    p_fecha_hasta TIMESTAMPTZ DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0,
    p_sort_column VARCHAR DEFAULT 'created_at',
    p_sort_order VARCHAR DEFAULT 'desc'
)
RETURNS TABLE (
    id UUID,
    usuario_id UUID,
    accion VARCHAR,
    tabla_afectada VARCHAR,
    registro_id UUID,
    campo_modificado VARCHAR,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    ip_address VARCHAR,
    created_at TIMESTAMPTZ,
    usuario_nombre VARCHAR,
    usuario_apellido VARCHAR,
    usuario_email VARCHAR,
    entidad_codigo VARCHAR, -- New column for readable code/cedula
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Use CTE to apply filters once and get total count consistently
    WITH filtered_logs AS (
        SELECT 
            al.id,
            al.usuario_id,
            al.accion,
            al.tabla_afectada,
            al.registro_id,
            al.campo_modificado,
            al.valor_anterior,
            al.valor_nuevo,
            al.ip_address,
            al.created_at,
            u.nombre AS usuario_nombre,
            u.apellido AS usuario_apellido,
            u.email AS usuario_email
        FROM public.audit_log al
        LEFT JOIN public.usuarios u ON al.usuario_id = u.id
        WHERE 
            -- Role-based filter
            (
                p_admin_id IS NULL 
                OR al.usuario_id = p_admin_id 
                OR al.usuario_id IN (
                    SELECT DISTINCT ce.encargado_id 
                    FROM public.cartera_encargados ce
                    JOIN public.carteras c ON ce.cartera_id = c.id
                    WHERE c.admin_id = p_admin_id
                )
            )
            -- Additional filters
            AND (p_usuario_filter IS NULL OR al.usuario_id = p_usuario_filter)
            AND (p_accion IS NULL OR al.accion = p_accion)
            AND (p_tabla IS NULL OR al.tabla_afectada = p_tabla)
            AND (p_fecha_desde IS NULL OR al.created_at >= p_fecha_desde)
            AND (p_fecha_hasta IS NULL OR al.created_at <= p_fecha_hasta)
            
            -- NOISE FILTER: Same logic as before, now applied universally
            AND NOT (
                al.accion = 'actualizar' 
                AND (
                    (al.tabla_afectada = 'carteras' AND al.campo_modificado IN ('saldo_actual', 'saldo_prestado', 'registro_pagos_id', 'updated_at'))
                    OR
                    (al.tabla_afectada = 'creditos' AND al.campo_modificado IN ('saldo_capital_pendiente', 'saldo_interes_pendiente', 'updated_at'))
                    OR
                    (al.tabla_afectada = 'clientes' AND al.campo_modificado NOT IN ('nombre', 'apellido', 'cedula', 'movil', 'email', 'direccion', 'estado')) 
                    OR
                    (al.tabla_afectada = 'amortizaciones')
                    OR
                    (al.tabla_afectada = 'pagos' AND al.campo_modificado IN ('updated_at'))
                    OR
                    (al.campo_modificado = 'updated_at')
                )
            )
    ),
    total_cte AS (
        SELECT COUNT(*) AS total FROM filtered_logs
    )
    SELECT 
        fl.id,
        fl.usuario_id,
        fl.accion,
        fl.tabla_afectada,
        fl.registro_id,
        fl.campo_modificado,
        fl.valor_anterior,
        fl.valor_nuevo,
        fl.ip_address,
        fl.created_at,
        fl.usuario_nombre,
        fl.usuario_apellido,
        fl.usuario_email,
        -- Fetch readable code based on table
        CASE 
            WHEN fl.tabla_afectada = 'carteras' THEN c_cart.codigo
            WHEN fl.tabla_afectada = 'creditos' THEN c_cred.codigo
            WHEN fl.tabla_afectada = 'clientes' THEN c_cli.cedula
            WHEN fl.tabla_afectada = 'usuarios' THEN c_usr.cedula
            WHEN fl.tabla_afectada = 'pagos' THEN c_pago_cred.codigo
            ELSE NULL
        END AS entidad_codigo,
        (SELECT total FROM total_cte) AS total_count
    FROM filtered_logs fl
    -- Joins to fetch readable codes
    LEFT JOIN public.carteras c_cart ON fl.tabla_afectada = 'carteras' AND fl.registro_id = c_cart.id
    LEFT JOIN public.creditos c_cred ON fl.tabla_afectada = 'creditos' AND fl.registro_id = c_cred.id
    LEFT JOIN public.clientes c_cli ON fl.tabla_afectada = 'clientes' AND fl.registro_id = c_cli.id
    LEFT JOIN public.usuarios c_usr ON fl.tabla_afectada = 'usuarios' AND fl.registro_id = c_usr.id
    LEFT JOIN public.pagos p ON fl.tabla_afectada = 'pagos' AND fl.registro_id = p.id
    LEFT JOIN public.creditos c_pago_cred ON p.credito_id = c_pago_cred.id
    ORDER BY
        CASE WHEN p_sort_order = 'asc' THEN
            CASE 
                WHEN p_sort_column = 'created_at' THEN EXTRACT(EPOCH FROM fl.created_at)
                WHEN p_sort_column = 'usuario' THEN CAST(ASCII(SUBSTRING(fl.usuario_nombre FROM 1 FOR 1)) AS NUMERIC)
                ELSE EXTRACT(EPOCH FROM fl.created_at)
            END
        END ASC,
        CASE WHEN p_sort_order = 'desc' THEN
             CASE 
                WHEN p_sort_column = 'created_at' THEN EXTRACT(EPOCH FROM fl.created_at)
                ELSE EXTRACT(EPOCH FROM fl.created_at)
            END
        END DESC,
        CASE WHEN p_sort_order = 'asc' THEN
            CASE
                WHEN p_sort_column = 'usuario' THEN fl.usuario_nombre
                WHEN p_sort_column = 'accion' THEN fl.accion
                WHEN p_sort_column = 'entidad' THEN fl.tabla_afectada
                WHEN p_sort_column = 'codigo' THEN COALESCE(c_cart.codigo, c_cred.codigo, c_cli.cedula, c_usr.cedula, c_pago_cred.codigo)
                WHEN p_sort_column = 'campo' THEN fl.campo_modificado
                WHEN p_sort_column = 'valor_anterior' THEN fl.valor_anterior
                WHEN p_sort_column = 'valor_nuevo' THEN fl.valor_nuevo
                ELSE NULL
            END
        END ASC NULLS LAST,
        CASE WHEN p_sort_order = 'desc' THEN
            CASE
                WHEN p_sort_column = 'usuario' THEN fl.usuario_nombre
                WHEN p_sort_column = 'accion' THEN fl.accion
                WHEN p_sort_column = 'entidad' THEN fl.tabla_afectada
                WHEN p_sort_column = 'codigo' THEN COALESCE(c_cart.codigo, c_cred.codigo, c_cli.cedula, c_usr.cedula, c_pago_cred.codigo)
                WHEN p_sort_column = 'campo' THEN fl.campo_modificado
                WHEN p_sort_column = 'valor_anterior' THEN fl.valor_anterior
                WHEN p_sort_column = 'valor_nuevo' THEN fl.valor_nuevo
                ELSE NULL
            END
        END DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Also create a function to get users allowed for admin filter dropdown
CREATE OR REPLACE FUNCTION public.get_audit_users_by_role(
    p_admin_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    nombre VARCHAR,
    apellido VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT u.id, u.nombre, u.apellido
    FROM public.audit_log al
    JOIN public.usuarios u ON al.usuario_id = u.id
    WHERE 
        p_admin_id IS NULL  -- Super Admin sees all
        OR al.usuario_id = p_admin_id  -- Admin's own
        OR al.usuario_id IN (
            SELECT DISTINCT ce.encargado_id 
            FROM public.cartera_encargados ce
            JOIN public.carteras c ON ce.cartera_id = c.id
            WHERE c.admin_id = p_admin_id
        )
    ORDER BY u.nombre, u.apellido;
END;
$$;
