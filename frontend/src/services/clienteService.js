import { supabase } from './supabaseClient';

/**
 * Service to manage Clients
 */
export const clienteService = {
    /**
     * Get all clientes for the current user
     */
    getClientes: async () => {
        try {
            const { data: clientes, error } = await supabase
                .from('clientes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Calculate active loans manually to ensure accuracy without new SQL functions
            const { data: activeCreditos, error: errCred } = await supabase
                .from('creditos')
                .select('cliente_id')
                .or('estado.eq.activo,estado.eq.vencido');

            const counts = {};
            if (!errCred && activeCreditos) {
                activeCreditos.forEach(c => {
                    counts[c.cliente_id] = (counts[c.cliente_id] || 0) + 1;
                });
            }

            return clientes.map(c => ({
                ...c,
                prestamos_activos: counts[c.id] || 0
            }));
        } catch (error) {
            console.error('Error fetching clientes:', error);
            throw error;
        }
    },

    /**
     * Check if a cliente with the given cedula already exists for this admin.
     * Uses RPC to bypass RLS for Encargados checking Admin's clients.
     * @param {string} cedula - The document number to check
     * @param {string} adminId - The admin's ID (scope of the check)
     * @returns {{ exists: boolean, cliente?: object }} - Whether it exists and the client data if found
     */
    checkCedulaExists: async (cedula, adminId) => {
        try {
            // Use Secure RPC to bypass RLS (needed for Encargados)
            const { data, error } = await supabase.rpc('check_cliente_duplicate_secure', {
                p_cedula: cedula,
                p_admin_id: adminId
            });

            if (error) {
                console.error('RPC Error checking cedula:', error);
                // Fallback to standard select (works for Admin, maybe fails for Encargado)
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('clientes')
                    .select('id, nombre, apellido, cedula, creado_por_id')
                    .eq('cedula', cedula)
                    .eq('admin_id', adminId)
                    .maybeSingle();

                if (fallbackError) throw fallbackError;
                return { exists: !!fallbackData, cliente: fallbackData };
            }

            // RPC can return array or single object depending on definition, 
            // but wrapped in .single() or array check. RPC returns SETOF, so data is array.
            const existing = data && data.length > 0 ? data[0] : null;
            return { exists: !!existing, cliente: existing };
        } catch (error) {
            console.error('Error checking cedula:', error);
            throw error;
        }
    },

    /**
     * Link an existing cliente to an Encargado by adding them to `colaboradores` array.
     * Uses RPC to bypass RLS during the update (SECURITY DEFINER).
     * @param {string} clienteId - The existing cliente ID
     * @param {string} encargadoId - The encargado to link
     */
    linkClienteToEncargado: async (clienteId, encargadoId) => {
        try {
            const { data, error } = await supabase.rpc('vincular_cliente_encargado', {
                p_cliente_id: clienteId,
                p_encargado_id: encargadoId
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            return data;
        } catch (error) {
            console.error('Error linking cliente:', error);
            throw error;
        }
    },

    /**
     * Create a new cliente
     * @param {object} clientData
     * @param {string} adminId - The admin who owns this client
     * @param {string} creadoPorId - The user who is creating (can be admin or encargado)
     */
    createCliente: async (clientData, adminId, creadoPorId) => {
        try {
            const payload = {
                ...clientData,
                admin_id: adminId,
                creado_por_id: creadoPorId || adminId, // If not provided, assume admin created it
                estado: 'activo',
                // scoring defaults
                calificacion_score: 100,
                calificacion_color: 'verde',
                total_prestamos: 0,
                total_refinanciamientos: 0,
                dias_promedio_retraso: 0
            };

            const { data, error } = await supabase
                .from('clientes')
                .insert([payload])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    throw new Error('Ya existe un cliente con esta cédula en tu sistema.');
                }
                throw error;
            }
            return { success: true, data };
        } catch (error) {
            console.error('Error creating cliente:', error);
            throw error;
        }
    },

    /**
     * Update an existing cliente
     */
    updateCliente: async (id, updates) => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating cliente:', error);
            throw error;
        }
    },

    /**
     * Archive a client (Soft Delete) mechanism.
     * Sets state to 'inactivo' instead of deleting.
     */
    archivarCliente: async (id) => {
        try {
            // 1. Validar si tiene préstamos activos o vencidos
            const { count, error: countError } = await supabase
                .from('creditos')
                .select('*', { count: 'exact', head: true })
                .eq('cliente_id', id)
                .or('estado.eq.activo,estado.eq.vencido');

            if (countError) throw countError;

            if (count > 0) {
                throw new Error(`No se puede archivar: El cliente tiene ${count} préstamo(s) activos o vencidos.`);
            }

            // 2. Proceder a archivar
            const { data, error } = await supabase
                .from('clientes')
                .update({ estado: 'inactivo' })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error archiving cliente:', error);
            throw error;
        }
    },

    /**
     * Restore an archived client to active state.
     */
    activarCliente: async (id) => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .update({ estado: 'activo' })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error activating cliente:', error);
            throw error;
        }
    },

    /**
     * Search clientes by query (name, document, phone)
     * Note: This simple search filters results client-side or simple ILIKE server side.
     * We will use simple ILIKE on the server for efficiency if possible, but RLS makes client-side filtering easy for small datasets.
     */
    searchClientes: async (term) => {
        // Implementation typically handled in the UI filtering for small < 1000 datasets
        // Or can use .or(`nombre.ilike.%${term}%,cedula.ilike.%${term}%`)
    }
};

