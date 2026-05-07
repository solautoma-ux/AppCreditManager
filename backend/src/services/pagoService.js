import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export const pagoService = {
    registrarPago: async (str_userToken, obj_pagoData, str_registradoPorId) => {
        try {
            const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${str_userToken}` } }
            });

            const {
                str_creditoId,
                dbl_montoTotal,
                dbl_montoCapital,
                dbl_montoInteres,
                date_fechaPago,
                str_notas
            } = obj_pagoData;

            const { data, error } = await supabaseUser.rpc('registrar_pago_completo', {
                p_credito_id: str_creditoId,
                p_monto_total: parseFloat(dbl_montoTotal),
                p_monto_a_capital: parseFloat(dbl_montoCapital),
                p_monto_a_interes: parseFloat(dbl_montoInteres),
                p_fecha_pago: date_fechaPago,
                p_registrado_por: str_registradoPorId,
                p_notas: str_notas
            });

            if (error) throw error;

            return {
                success: true,
                nuevoSaldo: data.nuevo_saldo_total,
                pagado: data.nuevo_estado === 'pagado'
            };
        } catch (error) {
            throw error;
        }
    },

    reprogramarCredito: async (str_userToken, str_creditoId, date_nuevaFecha) => {
        try {
            const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${str_userToken}` } }
            });

            const { data, error } = await supabaseUser.rpc('reprogramar_fecha_inicio_credito', {
                p_credito_id: str_creditoId,
                p_nueva_fecha: date_nuevaFecha
            });

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    deshacerPago: async (str_userToken, str_pagoId, str_adminId) => {
        try {
            const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${str_userToken}` } }
            });

            const { data, error } = await supabaseUser.rpc('deshacer_pago', {
                p_pago_id: str_pagoId,
                p_admin_id: str_adminId
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error);
            return data;
        } catch (error) {
            throw error;
        }
    },

    getPagosCredito: async (str_userToken, str_creditoId) => {
        try {
            const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${str_userToken}` } }
            });

            const { data, error } = await supabaseUser
                .from('pagos')
                .select('*, registrado_por:registrado_por_id(nombre, apellido)')
                .eq('credito_id', str_creditoId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    getCreditoDetalle: async (str_userToken, str_creditoId) => {
        try {
            const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${str_userToken}` } }
            });

            const { data, error } = await supabaseUser
                .from('creditos')
                .select(`
                    *,
                    cliente:clientes(nombre, apellido, cedula, movil),
                    cartera:carteras(nombre),
                    amortizaciones:amortizaciones(*)
                `)
                .eq('id', str_creditoId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    }
};
