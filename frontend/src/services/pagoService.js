import { supabase } from './supabaseClient';

/**
 * Service for Payment (Pago) Management
 */
export const pagoService = {
    /**
     * Register a payment for a credit
     * Updates payment record and credit balances
     * @param {object} pagoData - { credito_id, monto_total, monto_a_capital, monto_a_interes, fecha_pago, notas }
     * @param {string} registradoPorId - ID of user registering the payment
     */
    registrarPago: async (pagoData, registradoPorId) => {
        try {
            const { credito_id, monto_total, monto_a_capital, monto_a_interes, fecha_pago, notas } = pagoData;

            // Call atomic RPC function
            const { data, error } = await supabase.rpc('registrar_pago_completo', {
                p_credito_id: credito_id,
                p_monto_total: parseFloat(monto_total),
                p_monto_a_capital: parseFloat(monto_a_capital),
                p_monto_a_interes: parseFloat(monto_a_interes),
                p_fecha_pago: fecha_pago,
                p_registrado_por: registradoPorId,
                p_notas: notas
            });

            if (error) throw error;

            return {
                success: true,
                nuevoSaldo: data.nuevo_saldo_total,
                pagado: data.nuevo_estado === 'pagado'
            };
        } catch (error) {
            console.error('Error registrando pago:', error);
            throw error;
        }
    },

    /**
     * Reprogramar la fecha de inicio de un crédito (Solo si no tiene pagos).
     * @param {string} creditoId 
     * @param {string} nuevaFecha - YYYY-MM-DD
     */
    reprogramarCredito: async (creditoId, nuevaFecha) => {
        try {
            const { data, error } = await supabase.rpc('reprogramar_fecha_inicio_credito', {
                p_credito_id: creditoId,
                p_nueva_fecha: nuevaFecha
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error reprogramando crédito:', error);
            throw error;
        }
    },

    /**
     * Deshace el último pago válido de un crédito (Regla LIFO, max 24h)
     */
    deshacerPago: async (pagoId, adminId) => {
        try {
            const { data, error } = await supabase.rpc('deshacer_pago', {
                p_pago_id: pagoId,
                p_admin_id: adminId
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.error);
            return data;
        } catch (error) {
            console.error('Error deshaciendo pago:', error);
            throw error;
        }
    },

    /**
     * Get all payments for a specific credit
     */
    getPagosCredito: async (creditoId) => {
        try {
            const { data, error } = await supabase
                .from('pagos')
                .select('*, registrado_por:registrado_por_id(nombre, apellido)')
                .eq('credito_id', creditoId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching pagos:', error);
            throw error;
        }
    },

    /**
     * Get credit detail with amortization schedule
     */
    getCreditoDetalle: async (creditoId) => {
        try {
            const { data, error } = await supabase
                .from('creditos')
                .select(`
                    *,
                    cliente:clientes(nombre, apellido, cedula, movil),
                    cartera:carteras(nombre),
                    amortizaciones:amortizaciones(*)
                `)
                .eq('id', creditoId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching credito detalle:', error);
            throw error;
        }
    }
};
