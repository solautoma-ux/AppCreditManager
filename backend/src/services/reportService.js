import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Service for Financial Reports
 */
export const getFinancialKPIs = async (str_fechaInicio, str_fechaFin, str_carteraId = null, str_adminId = null, str_encargadoId = null) => {
    try {
        const { data: obj_data, error: obj_error } = await supabase.rpc('get_kpis_financieros', {
            p_fecha_inicio: str_fechaInicio,
            p_fecha_fin: str_fechaFin,
            p_cartera_id: str_carteraId,
            p_admin_id: str_adminId,
            p_encargado_id: str_encargadoId
        });

        if (obj_error) throw obj_error;
        return obj_data;
    } catch (error) {
        throw error;
    }
};

export const getDetailedMorosidad = async (str_carteraId = null, str_adminId = null, str_encargadoId = null) => {
    try {
        const { data: arr_data, error: obj_error } = await supabase.rpc('get_reporte_morosidad_detallado', {
            p_cartera_id: str_carteraId,
            p_admin_id: str_adminId,
            p_encargado_id: str_encargadoId
        });

        if (obj_error) throw obj_error;
        return arr_data;
    } catch (error) {
        throw error;
    }
};

export const getDetailedMovements = async (str_fechaInicio, str_fechaFin, str_carteraId = null, str_adminId = null, str_encargadoId = null) => {
    try {
        const { data: arr_data, error: obj_error } = await supabase.rpc('get_reporte_movimientos_detallados', {
            p_fecha_inicio: str_fechaInicio,
            p_fecha_fin: str_fechaFin,
            p_cartera_id: str_carteraId,
            p_admin_id: str_adminId,
            p_encargado_id: str_encargadoId
        });

        if (obj_error) throw obj_error;
        return arr_data;
    } catch (error) {
        throw error;
    }
};
