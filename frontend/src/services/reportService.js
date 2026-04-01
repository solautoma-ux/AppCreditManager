import { supabase } from './supabaseClient';

/**
 * Service for Financial Reports
 * All methods support role-based filtering:
 * - Admin: Pass adminId to see their carteras
 * - Encargado: Pass encargadoId to see only assigned carteras
 * - Super Admin: Pass neither to see everything
 */
export const reportService = {
    /**
     * Obtiene los KPIs financieros para el rango de fechas seleccionado
     * @param {Date|string} fechaInicio 
     * @param {Date|string} fechaFin 
     * @param {string|null} carteraId - Optional cartera filter
     * @param {string|null} adminId - Filter by admin (for admins)
     * @param {string|null} encargadoId - Filter by encargado assignment (for encargados)
     */
    getFinancialKPIs: async (fechaInicio, fechaFin, carteraId = null, adminId = null, encargadoId = null) => {
        try {
            const { data, error } = await supabase.rpc('get_kpis_financieros', {
                p_fecha_inicio: fechaInicio,
                p_fecha_fin: fechaFin,
                p_cartera_id: carteraId,
                p_admin_id: adminId,
                p_encargado_id: encargadoId
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching KPIs:', error);
            throw error;
        }
    },

    /**
     * Obtiene el listado detallado de morosidad
     */
    getDetailedMorosidad: async (carteraId = null, adminId = null, encargadoId = null) => {
        try {
            const { data, error } = await supabase.rpc('get_reporte_morosidad_detallado', {
                p_cartera_id: carteraId,
                p_admin_id: adminId,
                p_encargado_id: encargadoId
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching Morosidad Detallada:', error);
            throw error;
        }
    },

    /**
     * Obtiene el listado detallado de movimientos (Desembolsos y Recaudos)
     */
    getDetailedMovements: async (fechaInicio, fechaFin, carteraId = null, adminId = null, encargadoId = null) => {
        try {
            const { data, error } = await supabase.rpc('get_reporte_movimientos_detallados', {
                p_fecha_inicio: fechaInicio,
                p_fecha_fin: fechaFin,
                p_cartera_id: carteraId,
                p_admin_id: adminId,
                p_encargado_id: encargadoId
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching Detailed Movements:', error);
            throw error;
        }
    }
};
