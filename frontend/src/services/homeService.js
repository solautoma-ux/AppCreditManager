import { supabase } from './supabaseClient';

export const homeService = {
    /**
     * Get installments expiring today
     * @param {string} userId - ID of the logged in user
     * @param {string} role - 'admin', 'encargado'
     */
    getTodayPayments: async (userId, role) => {
        try {
            // Adjust for timezone to ensure we get LOCAL YYYY-MM-DD
            const now = new Date();
            const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
                .toISOString().split('T')[0];
            const today = localDate;

            // Trigger status update (fire and forget or await)
            await supabase.rpc('check_and_update_credit_statuses');

            // Build query for amortizaciones that expire today and are not paid
            let query = supabase
                .from('amortizaciones')
                .select(`
                    *,
                    credito:creditos!inner (
                        id,
                        monto_capital,
                        monto_total,
                        saldo_capital_pendiente,
                        saldo_interes_pendiente,
                        frecuencia_pago,
                        fecha_proximo_pago,
                        monto_cuota,
                        cartera_id,
                        estado,
                        cliente:clientes!inner (id, nombre, apellido, movil),
                        cartera:carteras (id, nombre)
                    )
                `)
                .gte('fecha_vencimiento', today)
                .lte('fecha_vencimiento', today)
                .neq('estado', 'pagada')
                .eq('credito.estado', 'activo')
                .order('id', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching today payments:', error);
            throw error;
        }
    },

    /**
     * Get installments overdue (before today)
     */
    getOverduePayments: async (userId, role) => {
        try {
            const now = new Date();
            const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
                .toISOString().split('T')[0];
            const today = localDate;

            let query = supabase
                .from('amortizaciones')
                .select(`
                    *,
                    credito:creditos!inner (
                        id,
                        monto_capital,
                        monto_total,
                        saldo_capital_pendiente,
                        saldo_interes_pendiente,
                        frecuencia_pago,
                        fecha_proximo_pago,
                        monto_cuota,
                        cartera_id,
                        estado,
                        cliente:clientes!inner (id, nombre, apellido, movil),
                        cartera:carteras (id, nombre)
                    )
                `)
                .lt('fecha_vencimiento', today)
                .neq('estado', 'pagada')
                .eq('credito.estado', 'activo')
                .order('fecha_vencimiento', { ascending: true }); // Oldest first

            const { data, error } = await query;
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching overdue payments:', error);
            throw error;
        }
    },

    /**
     * Get installments for credits that are explicitly in 'vencido' state
     */
    getVencidoInstallments: async (userId, role) => {
        try {
            let query = supabase
                .from('amortizaciones')
                .select(`
                    *,
                    credito:creditos!inner (
                        id,
                        monto_capital,
                        monto_total,
                        saldo_capital_pendiente,
                        saldo_interes_pendiente,
                        frecuencia_pago,
                        fecha_proximo_pago,
                        monto_cuota,
                        cartera_id,
                        estado,
                        cliente:clientes!inner (id, nombre, apellido, movil),
                        cartera:carteras (id, nombre)
                    )
                `)
                .neq('estado', 'pagada')
                .eq('credito.estado', 'vencido')
                .order('fecha_vencimiento', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching vencido installments:', error);
            throw error;
        }
    },

    /**
     * Get ALL pending installments (Debug only)
     */
    getAllPendingAmortizaciones: async () => {
        try {
            let query = supabase
                .from('amortizaciones')
                .select(`
                    *,
                    credito:creditos!inner (
                        id,
                        monto_capital,
                        cartera_id,
                        estado,
                        cliente:clientes (id, nombre, apellido, movil),
                        cartera:carteras (id, nombre)
                    )
                `)
                .neq('estado', 'pagada')
                .eq('credito.estado', 'activo')
                .order('fecha_vencimiento', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching all pending:', error);
            throw error;
        }
    },

    /**
     * Calculate Summary KPIs for Home
     */
    getHomeSummary: async () => {
        return {
            collectedToday: 0,
            pendingToday: 0
        };
    }
};
