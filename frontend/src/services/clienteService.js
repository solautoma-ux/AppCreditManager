import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
};

export const clienteService = {
    getClientes: async () => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/clientes`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al obtener clientes');
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching clientes:', error);
            throw error;
        }
    },

    checkCedulaExists: async (cedula) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/clientes/check-cedula?cedula=${encodeURIComponent(cedula)}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al verificar cédula');
            }

            return await response.json();
        } catch (error) {
            console.error('Error checking cedula:', error);
            throw error;
        }
    },

    linkClienteToEncargado: async (clienteId, encargadoId) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/clientes/${clienteId}/vincular`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ encargado_id: encargadoId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al vincular cliente');
            }

            return await response.json();
        } catch (error) {
            console.error('Error linking cliente:', error);
            throw error;
        }
    },

    createCliente: async (clientData) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/clientes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al crear cliente');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating cliente:', error);
            throw error;
        }
    },

    updateCliente: async (id, updates) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/clientes/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al actualizar cliente');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating cliente:', error);
            throw error;
        }
    },

    archivarCliente: async (id) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/clientes/${id}/archivar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al archivar cliente');
            }

            return await response.json();
        } catch (error) {
            console.error('Error archiving cliente:', error);
            throw error;
        }
    },

    activarCliente: async (id) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${API_URL}/clientes/${id}/activar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al activar cliente');
            }

            return await response.json();
        } catch (error) {
            console.error('Error activating cliente:', error);
            throw error;
        }
    },

    searchClientes: async (term) => {
        // Implementación UI
    }
};
