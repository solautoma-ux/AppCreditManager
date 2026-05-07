import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
};

/**
 * Service for Payment (Pago) Management
 * Migrado al backend para aislamieno de datos
 */
export const pagoService = {
    registrarPago: async (pagoData, registradoPorId) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/pagos/registrar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                // El frontend sigue pasando los nombres originales, el backend los adapta a la nomenclatura
                body: JSON.stringify({ ...pagoData, registradoPorId })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al registrar el pago');
            return result.data;
        } catch (error) {
            console.error('Error registrando pago:', error);
            throw error;
        }
    },

    reprogramarCredito: async (creditoId, nuevaFecha) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/pagos/reprogramar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ credito_id: creditoId, nueva_fecha: nuevaFecha })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al reprogramar crédito');
            return result.data;
        } catch (error) {
            console.error('Error reprogramando crédito:', error);
            throw error;
        }
    },

    deshacerPago: async (pagoId, adminId) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/pagos/deshacer/${pagoId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al deshacer pago');
            return result.data;
        } catch (error) {
            console.error('Error deshaciendo pago:', error);
            throw error;
        }
    },

    getPagosCredito: async (creditoId) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/pagos/credito/${creditoId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al obtener pagos');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching pagos:', error);
            throw error;
        }
    },

    getCreditoDetalle: async (creditoId) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/pagos/credito-detalle/${creditoId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al obtener detalle del crédito');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching credito detalle:', error);
            throw error;
        }
    }
};
