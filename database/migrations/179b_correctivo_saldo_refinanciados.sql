-- SCRIPT CORRECTIVO: fix_saldo_refinanciados_historicos.sql
-- Propósito: Corrige el saldo_actual de las carteras que tengan créditos
--            refinanciados donde el interés pendiente del crédito original
--            no fue reconocido como ingreso en el momento de la refinanciación.
--
-- Cómo funciona:
--   Para cada cartera, busca créditos que sean "hijos" (tienen credito_padre_id)
--   cuyo padre fue marcado como 'refinanciado'. La diferencia entre el capital
--   del crédito nuevo y el capital del crédito padre ES el interés que fue
--   capitalizado pero nunca acreditado a la cartera.
--
-- SEGURIDAD: Solo suma la diferencia positiva (nuevo_capital > viejo_capital),
--            es decir, solo cuando hubo capitalización real de intereses.
--            Si el nuevo capital fue menor o igual al viejo, no hace nada.
--
-- EJECUCIÓN: Correr primero el SELECT de verificación, confirmar los montos,
--            luego correr el UPDATE.
-- ============================================================================

-- PASO 1: Verificación — Muestra el monto a ajustar por cartera ANTES de corregir
SELECT
    w.codigo                                           AS cartera_codigo,
    w.nombre                                           AS cartera_nombre,
    viejo.codigo                                       AS credito_original,
    nuevo.codigo                                       AS credito_refinanciado,
    viejo.monto_capital                                AS capital_original,
    nuevo.monto_capital                                AS capital_nuevo,
    (nuevo.monto_capital - viejo.monto_capital)        AS interes_no_reconocido,
    w.saldo_actual                                     AS saldo_actual_actual,
    w.saldo_actual + (nuevo.monto_capital - viejo.monto_capital) AS saldo_actual_corregido,
    w.monto_inicial                                    AS monto_inicial,
    (w.saldo_actual - w.monto_inicial)                 AS utilidad_antes,
    (w.saldo_actual + (nuevo.monto_capital - viejo.monto_capital) - w.monto_inicial) AS utilidad_despues
FROM public.creditos nuevo
JOIN public.creditos viejo ON nuevo.credito_padre_id = viejo.id
JOIN public.carteras w      ON nuevo.cartera_id = w.id
WHERE viejo.estado = 'refinanciado'
AND (nuevo.monto_capital - viejo.monto_capital) > 0
ORDER BY w.codigo;


-- ============================================================================
-- PASO 2: Corrección — Aplicar el ajuste al saldo_actual de cada cartera afectada
-- EJECUTAR SOLO DESPUÉS DE VERIFICAR EL PASO 1
-- ============================================================================

UPDATE public.carteras w
SET saldo_actual = w.saldo_actual + ajuste.total_interes_pendiente,
    updated_at   = NOW()
FROM (
    SELECT
        nuevo.cartera_id,
        -- Suma de todos los intereses capitalizados no reconocidos en esta cartera
        SUM(nuevo.monto_capital - viejo.monto_capital) AS total_interes_pendiente
    FROM public.creditos nuevo
    JOIN public.creditos viejo ON nuevo.credito_padre_id = viejo.id
    WHERE viejo.estado = 'refinanciado'
    AND (nuevo.monto_capital - viejo.monto_capital) > 0
    GROUP BY nuevo.cartera_id
) ajuste
WHERE w.id = ajuste.cartera_id;

-- PASO 3: Verificar resultado
SELECT
    codigo,
    nombre,
    monto_inicial,
    saldo_actual,
    (saldo_actual - monto_inicial) AS utilidad_disponible
FROM public.carteras
WHERE codigo = 'CART-6441';
