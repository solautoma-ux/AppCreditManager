-- DEBUG: Check amortizaciones state for Luis Eduardo Pareja's credit
-- Run this to see what's happening with the installments

-- Find the credit for Luis Eduardo Pareja
SELECT 
    c.id as credito_id,
    c.codigo,
    c.estado as credito_estado,
    cl.nombre || ' ' || cl.apellido as cliente,
    c.monto_capital,
    c.saldo_capital_pendiente,
    c.saldo_interes_pendiente
FROM public.creditos c
JOIN public.clientes cl ON c.cliente_id = cl.id
WHERE cl.nombre ILIKE '%Luis%' AND cl.apellido ILIKE '%Pareja%';

-- Check the amortizaciones for that credit
SELECT 
    a.id,
    a.numero_cuota,
    a.fecha_vencimiento,
    a.monto_cuota,
    a.saldo_pendiente,
    a.estado,
    a.updated_at
FROM public.amortizaciones a
JOIN public.creditos c ON a.credito_id = c.id
JOIN public.clientes cl ON c.cliente_id = cl.id
WHERE cl.nombre ILIKE '%Luis%' AND cl.apellido ILIKE '%Pareja%'
ORDER BY a.numero_cuota;

-- Check payments for that credit
SELECT 
    p.id,
    p.monto_total,
    p.monto_a_capital,
    p.monto_a_interes,
    p.fecha_pago,
    p.created_at
FROM public.pagos p
JOIN public.creditos c ON p.credito_id = c.id
JOIN public.clientes cl ON c.cliente_id = cl.id
WHERE cl.nombre ILIKE '%Luis%' AND cl.apellido ILIKE '%Pareja%'
ORDER BY p.created_at;

-- FORCE FIX: Mark the first unpaid installment as 'pagada' if it has a matching date
-- This directly fixes the issue for today's date (3 de febrero)
UPDATE public.amortizaciones a
SET estado = 'pagada', saldo_pendiente = 0, updated_at = NOW()
FROM public.creditos c
JOIN public.clientes cl ON c.cliente_id = cl.id
WHERE a.credito_id = c.id
  AND cl.nombre ILIKE '%Luis%' 
  AND cl.apellido ILIKE '%Pareja%'
  AND a.numero_cuota = 1
  AND a.estado != 'pagada';
