import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
};

const fetchApi = async (endpoint, options = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('No autenticado');

    const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    if (options.body) {
        headers['Content-Type'] = 'application/json';
        options.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Error en la petición');
    }
    return result;
};

export const carteraService = {
    getCarteras: async () => {
        try {
            return await fetchApi('/carteras');
        } catch (error) {
            console.error('Error fetching carteras:', error);
            throw error;
        }
    },

    createCartera: async (carteraData) => {
        try {
            return await fetchApi('/carteras', { method: 'POST', body: carteraData });
        } catch (error) {
            console.error('Error creating cartera:', error);
            throw error;
        }
    },

    updateCartera: async (id, updates) => {
        try {
            return await fetchApi(`/carteras/${id}`, { method: 'PUT', body: updates });
        } catch (error) {
            console.error('Error updating cartera:', error);
            throw error;
        }
    },

    archivarCartera: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/archivar`, { method: 'POST' });
        } catch (error) {
            console.error('Error archiving cartera:', error);
            throw error;
        }
    },

    deleteCarteraSeguro: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/seguro`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error deleting cartera:', error);
            throw error;
        }
    },

    assignEncargado: async (carteraId, encargadoId, adminId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/encargado`, {
                method: 'POST',
                body: { encargado_id: encargadoId } // adminId se maneja en el backend via token
            });
        } catch (error) {
            console.error('Error assigning encargado:', error);
            throw error;
        }
    },

    removeEncargado: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/encargado`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error removing encargado:', error);
            throw error;
        }
    },

    getCarteraEncargado: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/encargado`);
        } catch (error) {
            console.error('Error fetching encargado:', error);
            return null;
        }
    },

    getCarteraDetalle: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/detalle`);
        } catch (error) {
            console.error('Error fetching cartera detalle:', error);
            throw error;
        }
    },

    retirarUtilidad: async (carteraId, monto, notas = null) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/retiro`, {
                method: 'POST',
                body: { monto, notas }
            });
        } catch (error) {
            console.error('Error al retirar utilidad:', error);
            throw error;
        }
    },

    // TODO: updatePrestamo está en carteraService, debe ser movido a creditoService. 
    // Por retrocompatibilidad lo mapearemos aquí llamando a creditoService si hace falta.
    // Como el server lo maneja, mejor hacer el fetch directo a /api/creditos/:id
    updatePrestamo: async (creditoId, updates) => {
        try {
            return await fetchApi(`/creditos/${creditoId}`, { method: 'PUT', body: updates });
        } catch (error) {
            console.error('Error updating prestamo:', error);
            throw error;
        }
    }
};
