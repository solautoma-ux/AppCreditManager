import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const carteraService = {
    getCarteras: async (str_userToken) => {
        try {
            // Crear cliente scoped al usuario: la RLS de Supabase filtra automáticamente
            // las carteras que le pertenecen, exactamente igual que el frontend original.
            const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${str_userToken}` } }
            });

            const { data, error } = await supabaseUser
                .from('carteras')
                .select(`
                    *,
                    encargado_asignacion:cartera_encargados(
                        encargado:encargado_id(id, nombre, apellido)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(c => ({
                ...c,
                encargado: c.encargado_asignacion?.[0]?.encargado || null
            }));
        } catch (error) {
            throw error;
        }
    },

    createCartera: async (obj_carteraData) => {
        try {
            const { encargado_id, ...rest } = obj_carteraData;

            const obj_payload = {
                ...rest,
                saldo_actual: rest.monto_inicial,
                saldo_prestado: 0,
                estado: 'activa'
            };

            const { data, error } = await supabase
                .from('carteras')
                .insert([obj_payload])
                .select()
                .single();

            if (error) throw error;

            if (encargado_id && data) {
                await carteraService.assignEncargado(data.id, encargado_id, rest.admin_id);
            }

            return { success: true, data };
        } catch (error) {
            throw error;
        }
    },

    updateCartera: async (str_id, obj_updates, str_adminId) => {
        try {
            const safeUpdates = {
                nombre: obj_updates.nombre,
                estado: obj_updates.estado,
            };

            const { data, error } = await supabase
                .from('carteras')
                .update(safeUpdates)
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

    archivarCartera: async (str_carteraId) => {
        try {
            const { data, error } = await supabase.rpc('archivar_cartera_seguro', {
                p_cartera_id: str_carteraId
            });

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    deleteCarteraSeguro: async (str_carteraId) => {
        try {
            const { data, error } = await supabase.rpc('eliminar_cartera_seguro', {
                p_cartera_id: str_carteraId
            });

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    assignEncargado: async (str_carteraId, str_encargadoId, str_adminId) => {
        try {
            await supabase
                .from('cartera_encargados')
                .delete()
                .eq('cartera_id', str_carteraId);

            const { data, error } = await supabase
                .from('cartera_encargados')
                .insert([{
                    cartera_id: str_carteraId,
                    encargado_id: str_encargadoId,
                    asignado_por_id: str_adminId,
                    estado: 'activo'
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            throw error;
        }
    },

    removeEncargado: async (str_carteraId) => {
        try {
            const { error } = await supabase
                .from('cartera_encargados')
                .delete()
                .eq('cartera_id', str_carteraId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            throw error;
        }
    },

    getCarteraEncargado: async (str_carteraId) => {
        try {
            const { data, error } = await supabase
                .from('cartera_encargados')
                .select('*, encargado:encargado_id(id, nombre, apellido, email)')
                .eq('cartera_id', str_carteraId)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    getCarteraDetalle: async (str_carteraId) => {
        try {
            const { data: cartera, error: errCartera } = await supabase
                .from('carteras')
                .select(`
                    *,
                    encargado_asignacion:cartera_encargados(
                        encargado:encargado_id(id, nombre, apellido)
                    )
                `)
                .eq('id', str_carteraId)
                .single();

            if (errCartera) throw errCartera;

            const { data: creditos, error: errCreditos } = await supabase
                .from('creditos')
                .select(`
                    id, codigo, estado, monto_capital, monto_total, created_at,
                    cliente:clientes(id, nombre, apellido, cedula),
                    pagos(id, monto_total, monto_a_capital, monto_a_interes)
                `)
                .eq('cartera_id', str_carteraId)
                .order('created_at', { ascending: false });

            if (errCreditos) throw errCreditos;

            const loansWithStats = creditos.map(credito => {
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

            const carteraFlat = {
                ...cartera,
                encargado: cartera.encargado_asignacion?.[0]?.encargado || null
            };

            return { cartera: carteraFlat, creditos: loansWithStats };
        } catch (error) {
            throw error;
        }
    },

    retirarUtilidad: async (str_carteraId, dbl_monto, str_notas = null) => {
        try {
            const { data, error } = await supabase.rpc('retirar_utilidad_cartera', {
                p_cartera_id: str_carteraId,
                p_monto: parseFloat(dbl_monto),
                p_notas: str_notas
            });

            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    }
};
