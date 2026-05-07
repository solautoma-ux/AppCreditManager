import { supabase } from './supabaseClient';

/**
 * Service for Credit Logic and Data (Now consuming Backend APIs)
 */
export const creditoService = {
    simularCredito: async (capital, tasa, numeroCuotas, frecuencia, fechaInicio) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/simular`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    capital,
                    tasa,
                    numeroCuotas,
                    frecuencia,
                    fechaInicio
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error en la simulación');
            return result.data;
        } catch (error) {
            console.error('Error simulando crédito:', error);
            throw error;
        }
    },

    createCredito: async (creditoData) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/crear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(creditoData)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al crear crédito');
            return result.data;
        } catch (error) {
            console.error('Error creando crédito:', error);
            throw error;
        }
    },

    getCreditos: async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al obtener créditos');
            return result; // Devuelve el array directamente desde el controlador
        } catch (error) {
            console.error('Error in getCreditos:', error);
            throw error;
        }
    },

    verificarVencimientos: async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/vencimientos`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error verificando vencimientos');
            return result;
        } catch (error) {
            console.error('Error verifying overdue credits:', error);
            return { success: false, error };
        }
    },

    refinanciarCredito: async (originalCreditoId, newCreditoData) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/refinanciar/${originalCreditoId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newCreditoData)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al refinanciar crédito');
            return result.data;
        } catch (error) {
            console.error('Error refinanciando crédito:', error);
            throw error;
        }
    },

    deleteCreditoSeguro: async (creditoId) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/${creditoId}/seguro`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error eliminando crédito');
            return result;
        } catch (error) {
            console.error('Error deleting credito:', error);
            throw error;
        }
    },

    liquidarCreditoForzado: async (creditoId) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/${creditoId}/liquidar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error liquidando crédito');
            return result;
        } catch (error) {
            console.error('Error liquidating credito:', error);
            throw error;
        }
    },

    buscarCreditosPorCliente: async (term) => {
        if (!term || term.length < 2) return [];

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/buscar?term=${encodeURIComponent(term)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error buscando créditos');
            return result;
        } catch (error) {
            console.error('Error searching credits:', error);
            throw error;
        }
    },

    getCreditosByCliente: async (clienteId) => {
        if (!clienteId) return [];
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/creditos/cliente/${clienteId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error fetching client credits');
            return result;
        } catch (error) {
            console.error('Error fetching client credits:', error);
            throw error;
        }
    }
};
