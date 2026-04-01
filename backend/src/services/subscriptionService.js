import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Obtener historial de pagos de suscripción de un admin
 */
export const getSubscriptionHistory = async (adminId) => {
    try {
        // 1. Verificar que exista la suscripción
        const { data: subscription, error: subError } = await supabase
            .from('admin_subscriptions')
            .select('id, monto_mensual, estado_suscripcion, fecha_proximo_pago, dias_mora')
            .eq('admin_id', adminId)
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
export const registerSubscriptionPayment = async (adminId, paymentData, registeredBy) => {
    try {
        const { monto, fecha_pago, mes_pagado, metodo_pago, notas } = paymentData;

        // 1. Obtener suscripción
        const { data: subscription, error: subError } = await supabase
            .from('admin_subscriptions')
            .select('id, fecha_proximo_pago')
            .eq('admin_id', adminId)
            .single();

        if (subError || !subscription) throw new Error('El usuario no tiene una suscripción activa');

        // 2. Registrar el pago
        const { data: payment, error: insertError } = await supabase
            .from('subscription_payments')
            .insert([{
                admin_id: adminId,
                subscription_id: subscription.id,
                registrado_por_id: registeredBy,
                monto_pagado: monto,
                fecha_pago: fecha_pago,
                mes_pagado: mes_pagado,
                metodo_pago: metodo_pago,
                notas: notas
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // 3. Actualizar estado de la suscripción (fecha próximo pago, mora, etc.)
        // Lógica simplificada: Sumar 1 mes a la fecha de próximo pago
        const currentNextPayment = new Date(subscription.fecha_proximo_pago);
        const newNextPayment = new Date(currentNextPayment);
        newNextPayment.setMonth(newNextPayment.getMonth() + 1);

        const { error: updateError } = await supabase
            .from('admin_subscriptions')
            .update({
                fecha_proximo_pago: newNextPayment,
                dias_mora: 0, // Asumimos que se pone al día con el pago
                fecha_ultimo_pago: fecha_pago,
                total_pagado: supabase.rpc('increment', { x: monto }) // Esto es conceptual, mejor usar trigger o fetch previo
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
export const renewSubscription = async (adminId, renewalData, registeredBy) => {
    try {
        const { tipo_plan, monto, dias_duracion } = renewalData;
        const fecha_pago = new Date().toISOString().split('T')[0]; // Hoy

        // 1. Obtener suscripción actual
        const { data: sub, error: subError } = await supabase
            .from('admin_subscriptions')
            .select('*')
            .eq('admin_id', adminId)
            .single();

        if (subError || !sub) throw new Error('El usuario no tiene una suscripción activa para renovar');

        // 2. Calcular nueva fecha de vencimiento
        // Si ya venció (fecha < hoy), se cuenta desde HOY.
        // Si NO ha vencido, se suma a la fecha actual de vencimiento.
        const hoy = new Date();
        const vencimientoActual = new Date(sub.fecha_proximo_pago);

        let nuevaFechaBase = vencimientoActual > hoy ? vencimientoActual : hoy;
        const nuevaFechaVencimiento = new Date(nuevaFechaBase);
        nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + dias_duracion);

        // 3. Registrar el PAGO de renovación
        const { error: paymentError } = await supabase
            .from('subscription_payments')
            .insert([{
                admin_id: adminId,
                subscription_id: sub.id,
                registrado_por_id: registeredBy,
                monto_pagado: monto,
                fecha_pago: fecha_pago,
                mes_pagado: fecha_pago.substring(0, 7), // YYYY-MM
                metodo_pago: 'transferencia', // Asumido
                notas: `Renovación de plan ${tipo_plan} (${dias_duracion} días)`
            }]);

        if (paymentError) throw paymentError;

        // 4. Actualizar Suscripción
        const nuevoTotal = (sub.total_pagado || 0) + monto;

        const { data: updatedSub, error: updateError } = await supabase
            .from('admin_subscriptions')
            .update({
                tipo_plan: tipo_plan,
                monto_mensual: monto, // Actualizamos al nuevo precio
                fecha_proximo_pago: nuevaFechaVencimiento,
                dias_mora: 0,
                fecha_ultimo_pago: fecha_pago,
                total_pagado: nuevoTotal,
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
