import { supabase } from './supabaseClient';

/**
 * Service to manage Wallets (Carteras)
 */
export const carteraService = {
    /**
     * Get all carteras for the current user
     * RLS ensures Admins only see theirs, and Encargados see assigned ones
     */
    getCarteras: async () => {
        try {
            const { data, error } = await supabase
                .from('carteras')
                .select(`
                    *,
                    encargado_asignacion:cartera_encargados(
                        encargado:encargado_id(id, nombre, apellido)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Flatten encargado data for easier access
            return (data || []).map(c => ({
                ...c,
                encargado: c.encargado_asignacion?.[0]?.encargado || null
            }));
        } catch (error) {
            console.error('Error fetching carteras:', error);
            throw error;
        }
    },

    /**
     * Create a new cartera
     * @param {object} carteraData - { nombre, monto_inicial, codigo, admin_id }
     */
    createCartera: async (carteraData) => {
        try {
            // Extract encargado_id to avoid inserting it into foreign table directly
            const { encargado_id, ...rest } = carteraData;

            const payload = {
                ...rest,
                saldo_actual: rest.monto_inicial, // Start balance = Initial amount
                saldo_prestado: 0,
                estado: 'activa' // Default status is 'activa' (feminine for constraint)
            };

            const { data, error } = await supabase
                .from('carteras')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            // If encargado selected, assign it specifically
            if (encargado_id && data) {
                await carteraService.assignEncargado(data.id, encargado_id, rest.admin_id);
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error creating cartera:', error);
            throw error;
        }
    },

    /**
     * Update an existing cartera
     * Note: Does NOT update balance (safe update)
     */
    updateCartera: async (id, updates) => {
        try {
            // Protect sensitive fields just in case
            const safeUpdates = {
                nombre: updates.nombre,
                estado: updates.estado,
                // Do not allow updating saldo directly here
            };

            const { data, error } = await supabase
                .from('carteras')
                .update(safeUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating cartera:', error);
            throw error;
        }
    },

    /**
     * Archive a cartera via RPC.
     * Only succeeds if the cartera has NO active credits.
     * @returns {{ success: boolean, message: string }}
     */
    archivarCartera: async (carteraId) => {
        try {
            const { data, error } = await supabase.rpc('archivar_cartera_seguro', {
                p_cartera_id: carteraId
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error archiving cartera:', error);
            throw error;
        }
    },

    /**
     * Safe Delete a cartera via RPC.
     * Only succeeds if the cartera has NO associated credits.
     * @returns {{ success: boolean, message: string }}
     */
    deleteCarteraSeguro: async (carteraId) => {
        try {
            const { data, error } = await supabase.rpc('eliminar_cartera_seguro', {
                p_cartera_id: carteraId
            });

            if (error) throw error;
            return data; // { success: boolean, message: string }
        } catch (error) {
            console.error('Error deleting cartera:', error);
            throw error;
        }
    },

    /**
     * Assign an Encargado to a Cartera
     * Condition: The cartera must be unused (saldo_actual == monto_inicial)
     */
    assignEncargado: async (carteraId, encargadoId, adminId) => {
        try {
            // First check if assignment already exists and remove it
            await supabase
                .from('cartera_encargados')
                .delete()
                .eq('cartera_id', carteraId);

            // Insert new assignment
            const { data, error } = await supabase
                .from('cartera_encargados')
                .insert([{
                    cartera_id: carteraId,
                    encargado_id: encargadoId,
                    asignado_por_id: adminId,
                    estado: 'activo'
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error assigning encargado:', error);
            throw error;
        }
    },

    /**
     * Remove Encargado assignment from a Cartera
     */
    removeEncargado: async (carteraId) => {
        try {
            const { error } = await supabase
                .from('cartera_encargados')
                .delete()
                .eq('cartera_id', carteraId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error removing encargado:', error);
            throw error;
        }
    },

    /**
     * Get the assigned Encargado for a Cartera
     */
    getCarteraEncargado: async (carteraId) => {
        try {
            const { data, error } = await supabase
                .from('cartera_encargados')
                .select('*, encargado:encargado_id(id, nombre, apellido, email)')
                .eq('cartera_id', carteraId)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching encargado:', error);
            return null;
        }
    },

    /**
     * Get Detailed Cartera Info (Wallet + Loans + Stats)
     */
    getCarteraDetalle: async (carteraId) => {
        try {
            // 1. Get Cartera Basic Info
            const { data: cartera, error: errCartera } = await supabase
                .from('carteras')
                .select(`
                    *,
                    encargado_asignacion:cartera_encargados(
                        encargado:encargado_id(id, nombre, apellido)
                    )
                `)
                .eq('id', carteraId)
                .single();

            if (errCartera) throw errCartera;

            // 2. Get Associated Loans (Active or Liquidated needed for history? User said "historial completo")
            // Fetching all loans linked to this wallet
            const { data: creditos, error: errCreditos } = await supabase
                .from('creditos')
                .select(`
                    id, codigo, estado, monto_capital, monto_total, created_at,
                    cliente:clientes(id, nombre, apellido, cedula),
                    pagos(id, monto_total, monto_a_capital, monto_a_interes)
                `)
                .eq('cartera_id', carteraId)
                .order('created_at', { ascending: false });

            if (errCreditos) throw errCreditos;

            // 3. Process Loans and Calculate Totals
            // 3. Process Loans and Calculate Totals
            const loansWithStats = creditos.map(credito => {
                // Pagos are atomic transactions, assume all fetched are valid
                const pagosValidos = (credito.pagos || []);

                const abonoCapital = pagosValidos.reduce((sum, p) => sum + (p.monto_a_capital || 0), 0);
                const abonoInteres = pagosValidos.reduce((sum, p) => sum + (p.monto_a_interes || 0), 0);
                const totalPagado = pagosValidos.reduce((sum, p) => sum + (p.monto_total || 0), 0);

                return {
                    ...credito,
                    abono_capital: abonoCapital,
                    abono_interes: abonoInteres,
                    total_pagado: totalPagado
                };
            });

            // Flatten encargado
            const carteraFlat = {
                ...cartera,
                encargado: cartera.encargado_asignacion?.[0]?.encargado || null
            };

            return { cartera: carteraFlat, creditos: loansWithStats };

        } catch (error) {
            console.error('Error fetching cartera detalle:', error);
            throw error;
        }
    },

    /**
     * Update non-critical fields of a loan (notes, references)
     */
    updatePrestamo: async (creditoId, updates) => {
        try {
            // Filter allowed fields only to prevent hacking financial data
            const allowedUpdates = {};
            if (updates.notas !== undefined) allowedUpdates.notas = updates.notas;
            // Add other non-critical fields here if needed e.g., references

            const { data, error } = await supabase
                .from('creditos')
                .update(allowedUpdates)
                .eq('id', creditoId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating prestamo:', error);
            throw error;
        }
    },

    /**
     * Withdraw available profit from a Cartera
     * @param {string} carteraId - UUID of the cartera
     * @param {number} monto - Amount to withdraw
     * @param {string} notas - Optional notes for the transaction
     */
    retirarUtilidad: async (carteraId, monto, notas = null) => {
        try {
            const { data, error } = await supabase.rpc('retirar_utilidad_cartera', {
                p_cartera_id: carteraId,
                p_monto: monto,
                p_notas: notas
            });

            if (error) throw error;
            return data; // { success, message, nuevo_saldo_actual, utilidad_retirada_total }
        } catch (error) {
            console.error('Error al retirar utilidad:', error);
            throw error;
        }
    }
};
