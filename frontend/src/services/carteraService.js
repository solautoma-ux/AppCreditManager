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
    /**
     * Obtiene la lista de todas las carteras disponibles para el usuario autenticado.
     * @returns {Promise<Array>} Lista de carteras.
     */
    getCarteras: async () => {
        try {
            return await fetchApi('/carteras');
        } catch (error) {
            console.error('Error fetching carteras:', error);
            throw error;
        }
    },

    /**
     * Crea una nueva cartera en el sistema.
     * @param {Object} carteraData - Datos iniciales de la cartera (nombre, monto, etc).
     * @returns {Promise<Object>} La cartera creada.
     */
    createCartera: async (carteraData) => {
        try {
            return await fetchApi('/carteras', { method: 'POST', body: carteraData });
        } catch (error) {
            console.error('Error creating cartera:', error);
            throw error;
        }
    },

    /**
     * Actualiza los datos básicos de una cartera existente.
     * @param {string} id - UUID de la cartera.
     * @param {Object} updates - Campos a actualizar.
     * @returns {Promise<Object>} La cartera actualizada.
     */
    updateCartera: async (id, updates) => {
        try {
            return await fetchApi(`/carteras/${id}`, { method: 'PUT', body: updates });
        } catch (error) {
            console.error('Error updating cartera:', error);
            throw error;
        }
    },

    /**
     * Archiva una cartera (soft delete) previniendo nuevas operaciones.
     * @param {string} carteraId - UUID de la cartera.
     * @returns {Promise<Object>} Resultado de la operación.
     */
    archivarCartera: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/archivar`, { method: 'POST' });
        } catch (error) {
            console.error('Error archiving cartera:', error);
            throw error;
        }
    },

    /**
     * Elimina permanentemente una cartera de forma segura (si no tiene préstamos activos).
     * @param {string} carteraId - UUID de la cartera.
     * @returns {Promise<Object>} Resultado de la eliminación.
     */
    deleteCarteraSeguro: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/seguro`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error deleting cartera:', error);
            throw error;
        }
    },

    /**
     * Asigna un usuario con rol 'encargado' a una cartera específica.
     * @param {string} carteraId - UUID de la cartera.
     * @param {string} encargadoId - UUID del usuario encargado.
     * @param {string} adminId - (Opcional) ID del admin.
     * @returns {Promise<Object>} Registro de la asignación.
     */
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

    /**
     * Remueve la asignación del encargado actual de una cartera.
     * @param {string} carteraId - UUID de la cartera.
     * @returns {Promise<Object>} Resultado de la operación.
     */
    removeEncargado: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/encargado`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error removing encargado:', error);
            throw error;
        }
    },

    /**
     * Obtiene la información del encargado asignado actualmente a la cartera.
     * @param {string} carteraId - UUID de la cartera.
     * @returns {Promise<Object|null>} Datos del encargado o null si no hay.
     */
    getCarteraEncargado: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/encargado`);
        } catch (error) {
            console.error('Error fetching encargado:', error);
            return null;
        }
    },

    /**
     * Obtiene el detalle completo de una cartera, incluyendo estadísticas y préstamos asociados.
     * @param {string} carteraId - UUID de la cartera.
     * @returns {Promise<Object>} Detalle extendido de la cartera.
     */
    getCarteraDetalle: async (carteraId) => {
        try {
            return await fetchApi(`/carteras/${carteraId}/detalle`);
        } catch (error) {
            console.error('Error fetching cartera detalle:', error);
            throw error;
        }
    },

    /**
     * Registra el retiro de utilidades o ganancias de una cartera.
     * @param {string} carteraId - UUID de la cartera.
     * @param {number} monto - Cantidad a retirar.
     * @param {string} [notas=null] - Razón o justificación del retiro.
     * @returns {Promise<Object>} Registro del movimiento financiero.
     */
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

    /**
     * Actualiza un préstamo existente.
     * Nota de Arquitectura: Se mantiene en carteraService temporalmente por compatibilidad
     * hacia atrás. Internamente el API enruta al controlador correcto de créditos de forma segura.
     * @param {string} creditoId - UUID del préstamo/crédito.
     * @param {Object} updates - Información a actualizar.
     * @returns {Promise<Object>} Préstamo actualizado.
     */
    updatePrestamo: async (creditoId, updates) => {
        try {
            return await fetchApi(`/creditos/${creditoId}`, { method: 'PUT', body: updates });
        } catch (error) {
            console.error('Error updating prestamo:', error);
            throw error;
        }
    }
};
