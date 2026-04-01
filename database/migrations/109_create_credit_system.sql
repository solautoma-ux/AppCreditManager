-- MIGRATION: 109_create_credit_system
-- Parts:
-- 1. Table: amortizaciones (Schedule of payments)
-- 2. Function: crear_credito_completo (Atomic transaction)

-- 1. Tabla de Amortizaciones (Cuotas)
CREATE TABLE IF NOT EXISTS public.amortizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credito_id UUID NOT NULL REFERENCES public.creditos(id) ON DELETE CASCADE,
    numero_cuota INTEGER NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    monto_cuota DECIMAL(15,2) NOT NULL,
    capital_cuota DECIMAL(15,2) NOT NULL DEFAULT 0,
    interes_cuota DECIMAL(15,2) NOT NULL DEFAULT 0,
    saldo_pendiente DECIMAL(15,2) NOT NULL, -- Inicialmente igual a monto_cuota
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'mora')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(credito_id, numero_cuota)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_amortizaciones_credito ON public.amortizaciones(credito_id);
CREATE INDEX IF NOT EXISTS idx_amortizaciones_estado ON public.amortizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_amortizaciones_fecha ON public.amortizaciones(fecha_vencimiento);

-- RLS para Amortizaciones (Mismas reglas que Créditos)
ALTER TABLE public.amortizaciones ENABLE ROW LEVEL SECURITY;

-- Admin ve sus amortizaciones (via credito -> admin_id, pero requiere join costoso en RLS)
-- Simplificacion: Usamos una funcion helper o denormalizamos admin_id. 
-- Para MVP, vamos a denormalizar admin_id en amortizaciones para RLS rapido, o confiar en el padre.
-- Mejor estrategia: El usuario consulta amortizaciones filtrando por creditos que YA sabe que son suyos.
-- Pero para seguridad estricta:
CREATE POLICY "Admin manage own amortizations" ON public.amortizaciones
USING (
  EXISTS (
    SELECT 1 FROM public.creditos c 
    WHERE c.id = amortizaciones.credito_id 
    AND c.admin_id = public.current_user_id()
  )
);

CREATE POLICY "Super Admin view all amortizations" ON public.amortizaciones
FOR SELECT USING (
  public.current_user_role() = 'super_admin'
);


-- 2. Función Transaccional para Crear Crédito
-- Recibe los datos del crédito y un JSON con las cuotas para insertarlas en lote.
CREATE OR REPLACE FUNCTION public.crear_credito_completo(
    p_admin_id UUID,
    p_cartera_id UUID,
    p_cliente_id UUID,
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
    v_credito_id UUID;
    v_saldo_actual DECIMAL;
    v_codigo_credito VARCHAR;
BEGIN
    -- 1. Validar Saldo Cartera
    SELECT saldo_actual INTO v_saldo_actual
    FROM public.carteras
    WHERE id = p_cartera_id AND admin_id = p_admin_id
    FOR UPDATE; -- Bloquear fila para evitar condiciones de carrera

    IF v_saldo_actual IS NULL THEN
        RAISE EXCEPTION 'Cartera no encontrada o sin permiso';
    END IF;

    IF v_saldo_actual < p_monto_capital THEN
        RAISE EXCEPTION 'Saldo insuficiente en la cartera (Disponible: %, Requerido: %)', v_saldo_actual, p_monto_capital;
    END IF;

    -- 2. Generar Código Único (Ej: CR-12345)
    v_codigo_credito := 'CR-' || floor(random() * 100000)::text || '-' || to_char(now(), 'MMDD');

    -- 3. Insertar Crédito
    INSERT INTO public.creditos (
        codigo, admin_id, cartera_id, cliente_id, creado_por_id,
        monto_capital, tasa_interes, monto_interes_calculado, monto_total,
        plazo_numero, plazo_unidad, frecuencia_pago, numero_cuotas, monto_cuota,
        fecha_inicio, fecha_vencimiento, fecha_proximo_pago,
        saldo_capital_pendiente, saldo_interes_pendiente
    ) VALUES (
        v_codigo_credito, p_admin_id, p_cartera_id, p_cliente_id, p_admin_id, -- asumo admin crea por ahora
        p_monto_capital, p_tasa_interes, p_monto_interes_calculado, p_monto_total,
        p_plazo_numero, p_plazo_unidad, p_frecuencia_pago, p_numero_cuotas, p_monto_cuota,
        p_fecha_inicio, p_fecha_vencimiento, (p_cuotas_json->0->>'fecha_vencimiento')::DATE,
        p_monto_capital, p_monto_interes_calculado
    ) RETURNING id INTO v_credito_id;

    -- 4. Insertar Amortizaciones (Desde JSON)
    INSERT INTO public.amortizaciones (
        credito_id, numero_cuota, fecha_vencimiento, monto_cuota, 
        capital_cuota, interes_cuota, saldo_pendiente, estado
    )
    SELECT 
        v_credito_id,
        (value->>'numero')::INT,
        (value->>'fecha_vencimiento')::DATE,
        (value->>'monto_cuota')::DECIMAL,
        (value->>'capital')::DECIMAL,
        (value->>'interes')::DECIMAL,
        (value->>'monto_cuota')::DECIMAL, -- saldo pendiente inicial = total cuota
        'pendiente'
    FROM jsonb_array_elements(p_cuotas_json);

    -- 5. Actualizar Saldo Cartera
    UPDATE public.carteras
    SET 
        saldo_actual = saldo_actual - p_monto_capital,
        saldo_prestado = saldo_prestado + p_monto_capital,
        updated_at = NOW()
    WHERE id = p_cartera_id;

    RETURN jsonb_build_object('success', true, 'credito_id', v_credito_id);

EXCEPTION WHEN OTHERS THEN
    RAISE; -- Re-lanzar error para que el cliente lo vea
END;
$$;

-- Grant permissions
GRANT ALL ON public.amortizaciones TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_credito_completo TO authenticated;
