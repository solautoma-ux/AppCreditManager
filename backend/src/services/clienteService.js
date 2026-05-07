import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// En el backend usamos el service role key para realizar operaciones atómicas de forma segura
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const clienteService = {
    getClientes: async (str_adminId) => {
        try {
            // Se filtra explícitamente por admin_id, cumpliendo Regla #2 del Arquitecto
            const { data: arr_clientes, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('admin_id', str_adminId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Calcular préstamos activos
            const { data: arr_activeCreditos, error: errCred } = await supabase
                .from('creditos')
                .select('cliente_id, admin_id')
                .eq('admin_id', str_adminId)
                .or('estado.eq.activo,estado.eq.vencido');

            const obj_counts = {};
            if (!errCred && arr_activeCreditos) {
                arr_activeCreditos.forEach(c => {
                    obj_counts[c.cliente_id] = (obj_counts[c.cliente_id] || 0) + 1;
                });
            }

            return arr_clientes.map(c => ({
                ...c,
                prestamos_activos: obj_counts[c.id] || 0
            }));
        } catch (error) {
            throw error;
        }
    },

    checkCedulaExists: async (str_cedula, str_adminId) => {
        try {
            const { data, error } = await supabase.rpc('check_cliente_duplicate_secure', {
                p_cedula: str_cedula,
                p_admin_id: str_adminId
            });

            if (error) {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('clientes')
                    .select('id, nombre, apellido, cedula, creado_por_id')
                    .eq('cedula', str_cedula)
                    .eq('admin_id', str_adminId)
                    .maybeSingle();

                if (fallbackError) throw fallbackError;
                return { exists: !!fallbackData, cliente: fallbackData };
            }

            const obj_existing = data && data.length > 0 ? data[0] : null;
            return { exists: !!obj_existing, cliente: obj_existing };
        } catch (error) {
            throw error;
        }
    },

    linkClienteToEncargado: async (str_clienteId, str_encargadoId) => {
        try {
            const { data, error } = await supabase.rpc('vincular_cliente_encargado', {
                p_cliente_id: str_clienteId,
                p_encargado_id: str_encargadoId
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            return data;
        } catch (error) {
            throw error;
        }
    },

    createCliente: async (obj_clientData, str_adminId, str_creadoPorId) => {
        try {
            const obj_payload = {
                ...obj_clientData,
                admin_id: str_adminId,
                creado_por_id: str_creadoPorId || str_adminId,
                estado: 'activo',
                calificacion_score: 100,
                calificacion_color: 'verde',
                total_prestamos: 0,
                total_refinanciamientos: 0,
                dias_promedio_retraso: 0
            };

            const { data, error } = await supabase
                .from('clientes')
                .insert([obj_payload])
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
            throw error;
        }
    },

    updateCliente: async (str_id, obj_updates, str_adminId) => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .update(obj_updates)
                .eq('id', str_id)
                .eq('admin_id', str_adminId) // Seguridad: Solo si pertenece a este admin
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            throw error;
        }
    },

    archivarCliente: async (str_id, str_adminId) => {
        try {
            // 1. Validar si tiene préstamos activos
            const { count, error: countError } = await supabase
                .from('creditos')
                .select('*', { count: 'exact', head: true })
                .eq('cliente_id', str_id)
                .eq('admin_id', str_adminId)
                .or('estado.eq.activo,estado.eq.vencido');

            if (countError) throw countError;

            if (count > 0) {
                throw new Error(`No se puede archivar: El cliente tiene ${count} préstamo(s) activos o vencidos.`);
            }

            // 2. Proceder a archivar
            const { data, error } = await supabase
                .from('clientes')
                .update({ estado: 'inactivo' })
                .eq('id', str_id)
                .eq('admin_id', str_adminId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            throw error;
        }
    },

    activarCliente: async (str_id, str_adminId) => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .update({ estado: 'activo' })
                .eq('id', str_id)
                .eq('admin_id', str_adminId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            throw error;
        }
    }
};
