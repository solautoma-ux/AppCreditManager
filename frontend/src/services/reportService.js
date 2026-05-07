import { supabase } from './supabaseClient';

/**
 * Service for Financial Reports (Now consuming Backend API)
 * All methods automatically support role-based filtering on the backend via JWT.
 */
export const reportService = {
    /**
     * Obtiene los KPIs financieros para el rango de fechas seleccionado
     * @param {Date|string} fechaInicio 
     * @param {Date|string} fechaFin 
     * @param {string|null} carteraId - Optional cartera filter
     */
    getFinancialKPIs: async (fechaInicio, fechaFin, carteraId = null) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            let url = `${import.meta.env.VITE_API_URL}/reportes/kpis?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`;
            if (carteraId) url += `&carteraId=${encodeURIComponent(carteraId)}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al obtener KPIs');
            return result;
        } catch (error) {
            console.error('Error fetching KPIs:', error);
            throw error;
        }
    },

    /**
     * Obtiene el listado detallado de morosidad
     * @param {string|null} carteraId - Optional cartera filter
     */
    getDetailedMorosidad: async (carteraId = null) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            let url = `${import.meta.env.VITE_API_URL}/reportes/morosidad`;
            if (carteraId) url += `?carteraId=${encodeURIComponent(carteraId)}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al obtener morosidad');
            return result;
        } catch (error) {
            console.error('Error fetching Morosidad Detallada:', error);
            throw error;
        }
    },

    /**
     * Obtiene el listado detallado de movimientos (Desembolsos y Recaudos)
     * @param {Date|string} fechaInicio 
     * @param {Date|string} fechaFin 
     * @param {string|null} carteraId - Optional cartera filter
     */
    getDetailedMovements: async (fechaInicio, fechaFin, carteraId = null) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            let url = `${import.meta.env.VITE_API_URL}/reportes/movimientos?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`;
            if (carteraId) url += `&carteraId=${encodeURIComponent(carteraId)}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al obtener movimientos');
            return result;
        } catch (error) {
            console.error('Error fetching Detailed Movements:', error);
            throw error;
        }
    }
};
