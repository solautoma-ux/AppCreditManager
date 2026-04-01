-- Migration: 174_retiro_utilidades.sql
-- Description: Adds functionality for administrators to withdraw profits from a portfolio.
-- 1. Adds 'total_utilidad_retirada' column to 'carteras' table.
-- 2. Creates 'movimientos_cartera' table for transaction history.
-- 3. Creates RPC 'retirar_utilidad_cartera' to handle the logical deduction securely.

-- 1. Add column to carteras
ALTER TABLE public.carteras 
ADD COLUMN IF NOT EXISTS total_utilidad_retirada DECIMAL DEFAULT 0;

-- 2. Create history table
DROP TABLE IF EXISTS public.movimientos_cartera CASCADE;

CREATE TABLE public.movimientos_cartera (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cartera_id UUID NOT NULL REFERENCES public.carteras(id) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(50) NOT NULL CHECK (tipo_movimiento IN ('retiro_utilidad', 'inversion_adicional')),
    monto DECIMAL NOT NULL CHECK (monto > 0),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registrado_por_id UUID NOT NULL REFERENCES public.usuarios(id),
    notas TEXT
);

-- Permisos (RLS)
ALTER TABLE public.movimientos_cartera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins ver movimientos de sus carteras"
    ON public.movimientos_cartera FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.carteras c 
            WHERE c.id = cartera_id AND c.admin_id = auth.uid()
        )
    );

-- Permitir la acción 'retiro' en el registro de auditoría
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_accion_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_accion_check CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'habilitar', 'inhabilitar', 'retiro'));

-- 3. Create RPC for withdrawing profit
CREATE OR REPLACE FUNCTION public.retirar_utilidad_cartera(
    p_cartera_id UUID,
    p_monto DECIMAL,
    p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cartera RECORD;
    v_utilidad_disponible DECIMAL;
    v_new_actual DECIMAL;
    v_new_retirada DECIMAL;
BEGIN
    -- Only the admin_id (owner) can withdraw
    SELECT * INTO v_cartera 
    FROM public.carteras 
    WHERE id = p_cartera_id AND admin_id = public.current_user_id()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cartera no encontrada o no tienes permisos (Solo el dueño puede retirar).';
    END IF;

    -- Calculate current available profit
    v_utilidad_disponible := (v_cartera.saldo_actual + v_cartera.saldo_prestado) - v_cartera.monto_inicial;

    -- Validation 1: Amount <= Available Profit
    IF p_monto > v_utilidad_disponible THEN
        RAISE EXCEPTION 'El monto a retirar (%) supera la utilidad disponible (%)', p_monto, v_utilidad_disponible;
    END IF;

    -- Validation 2: Amount <= Physical Cash (saldo_actual)
    -- You cannot withdraw profit if it's currently loaned out.
    IF p_monto > v_cartera.saldo_actual THEN
        RAISE EXCEPTION 'No hay suficiente efectivo disponible (Saldo Actual: %) para retirar. Debe esperar recaudos.', v_cartera.saldo_actual;
    END IF;

    -- Calculate new values
    v_new_actual := v_cartera.saldo_actual - p_monto;
    v_new_retirada := COALESCE(v_cartera.total_utilidad_retirada, 0) + p_monto;

    -- Update Cartera
    UPDATE public.carteras
    SET 
        saldo_actual = v_new_actual,
        total_utilidad_retirada = v_new_retirada,
        updated_at = NOW()
    WHERE id = p_cartera_id;

    -- Insert record in movimientos_cartera
    INSERT INTO public.movimientos_cartera (
        cartera_id, tipo_movimiento, monto, registrado_por_id, notas
    ) VALUES (
        p_cartera_id, 'retiro_utilidad', p_monto, public.current_user_id(), p_notas
    );

    -- Delete the automatic UPDATE logs from the trigger for this specific transaction
    -- to avoid noise in the UI, since we will insert a cleaner 'retiro' log below.
    DELETE FROM public.audit_log 
    WHERE tabla_afectada = 'carteras' 
      AND registro_id = p_cartera_id 
      AND accion = 'actualizar' 
      AND campo_modificado IN ('saldo_actual', 'total_utilidad_retirada') 
      AND created_at >= NOW() - INTERVAL '2 seconds';

    -- Insert custom record directly into audit_log so that it appears perfectly formatted
    INSERT INTO public.audit_log (
        usuario_id,
        accion,
        tabla_afectada,
        registro_id,
        campo_modificado,
        valor_anterior,
        valor_nuevo
    ) VALUES (
        public.current_user_id(),
        'retiro',
        'carteras',
        p_cartera_id,
        'utilidad_disponible', 
        v_utilidad_disponible::TEXT,
        (v_utilidad_disponible - p_monto)::TEXT
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Retiro de utilidad registrado exitosamente.',
        'nuevo_saldo_actual', v_new_actual,
        'utilidad_retirada_total', v_new_retirada
    );
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
