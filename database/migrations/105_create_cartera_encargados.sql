-- FIX: Create missing 'cartera_encargados' table
-- Description: This table is required for the relation between Wallets and Officers.
-- Its absence caused errors in userService.getUsers('encargado').

CREATE TABLE IF NOT EXISTS public.cartera_encargados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cartera_id UUID NOT NULL REFERENCES carteras(id) ON DELETE CASCADE,
    encargado_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    asignado_por_id UUID NOT NULL REFERENCES usuarios(id),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(cartera_id, encargado_id)
);

-- Índices para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_cartera_encargados_cartera ON cartera_encargados(cartera_id);
CREATE INDEX IF NOT EXISTS idx_cartera_encargados_encargado ON cartera_encargados(encargado_id);

-- Habilitar RLS (Seguridad)
ALTER TABLE public.cartera_encargados ENABLE ROW LEVEL SECURITY;

-- Política RLS: Admins pueden ver asignaciones de sus carteras
CREATE POLICY "Admins view assignments" ON public.cartera_encargados
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.carteras 
    WHERE public.carteras.id = cartera_encargados.cartera_id 
    AND public.carteras.admin_id = public.current_user_id()
  )
);
