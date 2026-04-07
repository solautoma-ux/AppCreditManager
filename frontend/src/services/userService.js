import { supabase } from './supabaseClient';

/**
 * Service to manage users (Admins, Encargados)
 */

export const userService = {
    /**
     * Creates a new user (Invite flow)
     * Inserts into public.usuarios with auth_id = null
     * @param {object} userData - Form data
     * @param {string} creatorId - ID of the user creating this new user (for hierarchy)
     */
    createUser: async (userData, creatorId = null) => {
        try {
            const payload = {
                email: userData.email,
                nombre: userData.nombre,
                apellido: userData.apellido,
                cedula: userData.cedula,
                movil: userData.movil,
                rol: userData.rol,
                admin_padre_id: (userData.rol === 'encargado' && creatorId) ? creatorId : null
            };

            // Get token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/users/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al crear usuario via API');
            }

            return { success: true, data: result.data, message: result.message };
        } catch (error) {
            console.error('Error creating user (API):', error);
            throw error;
        }
    },

    /**
     * Updates an existing user
     * Separa los campos de usuario (tabla usuarios) de los campos de suscripción (tabla admin_subscriptions)
     * IMPORTANTE: Implementa UPSERT para suscripciones (crea si no existe, actualiza si existe)
     */
    updateUser: async (id, updates) => {
        try {
            // Separar campos de usuario vs suscripción
            const userFields = {};
            const subscriptionFields = {};

            // Lista de campos que pertenecen a la tabla usuarios
            const validUserFields = ['email', 'nombre', 'apellido', 'cedula', 'movil', 'estado', 'rol'];

            // Clasificar los campos (Evitando strings vacíos en fechas)
            Object.keys(updates).forEach(key => {
                const value = updates[key];
                
                if (validUserFields.includes(key)) {
                    userFields[key] = value;
                } else if (key === 'tipoPlan' && value) {
                    subscriptionFields.tipo_plan = value;
                } else if (key === 'montoSuscripcion' && value !== undefined && value !== '') {
                    subscriptionFields.monto_mensual = value;
                } else if (key === 'fechaInicioSuscripcion' && value && value !== '') {
                    subscriptionFields.fecha_inicio_suscripcion = value;
                } else if (key === 'fechaVencimiento' && value && value !== '') {
                    subscriptionFields.fecha_proximo_pago = value;
                }
            });

            // Actualizar tabla usuarios (solo si hay campos de usuario)
            if (Object.keys(userFields).length > 0) {
                const { error: userError } = await supabase
                    .from('usuarios')
                    .update(userFields)
                    .eq('id', id);

                if (userError) throw userError;
            }

            // UPSERT en admin_subscriptions (solo si hay campos de suscripción Y el admin está activo)
            if (Object.keys(subscriptionFields).length > 0) {
                // VALIDACIÓN CRÍTICA: No crear/actualizar suscripción si el admin está pendiente
                const estadoActual = userFields.estado || updates.estado;

                // Obtener el estado del admin si no viene en el update
                let bol_esPendiente = estadoActual === 'pendiente';

                if (!estadoActual) {
                    const { data: userData } = await supabase
                        .from('usuarios')
                        .select('estado')
                        .eq('id', id)
                        .single();

                    bol_esPendiente = userData?.estado === 'pendiente';
                }

                if (bol_esPendiente) {
                    console.log('Admin en estado pendiente, no se procesarán datos de suscripción hasta que acepte la invitación');
                    return { success: true, message: 'Usuario actualizado. La suscripción se activará cuando acepte la invitación.' };
                }

                // Verificar si ya existe un registro de suscripción
                const { data: existingSub, error: checkError } = await supabase
                    .from('admin_subscriptions')
                    .select('id')
                    .eq('admin_id', id)
                    .maybeSingle();

                if (checkError) throw checkError;

                if (existingSub) {
                    // UPDATE: Ya existe, actualizar
                    const { error: updateError } = await supabase
                        .from('admin_subscriptions')
                        .update(subscriptionFields)
                        .eq('admin_id', id);

                    if (updateError) throw updateError;
                } else {
                    // INSERT: No existe, crear nuevo registro
                    const str_fechaInicio = subscriptionFields.fecha_inicio_suscripcion || new Date().toISOString().split('T')[0];
                    const str_tipoPlan = subscriptionFields.tipo_plan || 'mensual';

                    // Calcular fecha_proximo_pago correctamente según el tipo de plan
                    let str_fechaVencimiento;
                    if (subscriptionFields.fecha_proximo_pago) {
                        // Si ya viene calculada desde el form, usarla
                        str_fechaVencimiento = subscriptionFields.fecha_proximo_pago;
                    } else {
                        // Calcular: fecha_inicio + duración del plan
                        // Parsear manualmente para evitar timezone offset (mismo fix que en UserFormModal)
                        const [year, month, day] = str_fechaInicio.split('-').map(Number);
                        const date_inicio = new Date(year, month - 1, day);

                        const int_diasAsumar = str_tipoPlan === 'anual' ? 365 : 30; // mensual y prueba_gratis son 30 días

                        // Sumar días
                        date_inicio.setDate(date_inicio.getDate() + int_diasAsumar);

                        // Formatear manualmente
                        const int_year = date_inicio.getFullYear();
                        const int_month = String(date_inicio.getMonth() + 1).padStart(2, '0');
                        const int_day = String(date_inicio.getDate()).padStart(2, '0');

                        str_fechaVencimiento = `${int_year}-${int_month}-${int_day}`;
                    }

                    const newSubscription = {
                        admin_id: id,
                        ...subscriptionFields,
                        // Campos requeridos con valores por defecto si no vienen en el update
                        monto_mensual: subscriptionFields.monto_mensual || 50000,
                        fecha_inicio_suscripcion: str_fechaInicio,
                        fecha_proximo_pago: str_fechaVencimiento,
                        tipo_plan: str_tipoPlan,
                        estado_suscripcion: 'activa',
                        dias_mora: 0,
                        total_pagado: 0
                    };

                    const { error: insertError } = await supabase
                        .from('admin_subscriptions')
                        .insert(newSubscription);

                    if (insertError) throw insertError;
                }
            }

            return { success: true, message: 'Usuario actualizado correctamente' };
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    },

    /**
     * Resend invitation email
     * @param {string} email 
     */
    resendInvite: async (email) => {
        try {
            // Get token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/users/resend-invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al reenviar invitación');
            }

            return { success: true, message: result.message };
        } catch (error) {
            console.error('Error resending invite:', error);
            throw error;
        }
    },

    /**
     * Get all users (filtered by role if needed)
     */
    getUsers: async (role = null) => {
        let query = supabase.from('usuarios').select('*');

        if (role === 'admin') {
            query = supabase.from('usuarios')
                .select('*, encargados:usuarios!admin_padre_id(count), carteras:carteras(count), suscripcion:admin_subscriptions(*)')
                .eq('rol', 'admin');
        } else if (role === 'encargado') {
            query = supabase.from('usuarios')
                .select('*, carteras_encargados:cartera_encargados!encargado_id(count)')
                .eq('rol', 'encargado');
        } else if (role) {
            query = query.eq('rol', role);
        }

        const { data, error } = await query;
        if (error) throw error;

        // DEBUG TEMPORAL: Ver qué devuelve Supabase para suscripciones
        if (data && data.length > 0) {
            console.log('[DEBUG] Primer usuario raw:', JSON.stringify(data[0], null, 2));
            console.log('[DEBUG] suscripcion raw:', data[0].suscripcion);
        }

        return data.map(user => ({
            ...user,
            encargados: user.encargados?.[0]?.count || 0,
            carteras: user.carteras?.[0]?.count || 0,
            carteras_count: user.carteras_encargados?.[0]?.count || 0,
            // Intentar ambas formas: array o objeto directo
            suscripcion: Array.isArray(user.suscripcion)
                ? (user.suscripcion?.[0] || null)
                : (user.suscripcion || null)
        }));
    },

    /**
     * Get detailed subscription history
     */
    getSubscriptionHistory: async (adminId) => {
        try {
            // Get token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${adminId}/subscription/history`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Error fetching subscription history');
            return await response.json();
        } catch (error) {
            console.error('Error in getSubscriptionHistory:', error);
            throw error;
        }
    },

    /**
     * Register a subscription payment
     */
    registerSubscriptionPayment: async (adminId, paymentData) => {
        try {
            // Get token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${adminId}/subscription/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(paymentData)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error registering payment');
            return result;
        } catch (error) {
            console.error('Error in registerSubscriptionPayment:', error);
            throw error;
        }
    },

    /**
     * Obtiene las carteras asignadas a un encargado con sus totales detallados
     * @param {string} encargadoId - ID del encargado
     * @returns {Promise<{carteras: Array, totales: Object}>}
     */
    getCarterasEncargado: async (encargadoId) => {
        try {
            // 1. Obtener IDs de carteras asignadas al encargado
            const { data: asignaciones, error: errAsign } = await supabase
                .from('cartera_encargados')
                .select('cartera_id')
                .eq('encargado_id', encargadoId);

            if (errAsign) throw errAsign;

            if (!asignaciones || asignaciones.length === 0) {
                return { carteras: [], totales: { saldoInicial: 0, totalPrestado: 0, saldoDisponible: 0 } };
            }

            const carteraIds = asignaciones.map(a => a.cartera_id);

            // 2. Obtener datos de las carteras (usamos * para asegurar traer monto_inicial)
            const { data: carteras, error: errCarteras } = await supabase
                .from('carteras')
                .select('*')
                .in('id', carteraIds);

            if (errCarteras) throw errCarteras;

            // 3. Obtener préstamos para calcular "Total Prestado" por cada cartera
            const carterasData = await Promise.all(carteras.map(async (cartera) => {
                const { data: creditos } = await supabase
                    .from('creditos')
                    .select('monto_capital, estado')
                    .eq('cartera_id', cartera.id)
                    .in('estado', ['activo', 'vencido']);

                const totalPrestado = creditos?.reduce((sum, c) => sum + (c.monto_capital || 0), 0) || 0;

                return {
                    ...cartera,
                    totalPrestado,
                    saldoDisponible: cartera.saldo_actual
                };
            }));

            // Calcular totales generales agregados
            const totales = carterasData.reduce((acc, c) => ({
                saldoInicial: acc.saldoInicial + (c.monto_inicial || 0),
                totalPrestado: acc.totalPrestado + (c.totalPrestado || 0),
                saldoDisponible: acc.saldoDisponible + (c.saldo_actual || 0)
            }), { saldoInicial: 0, totalPrestado: 0, saldoDisponible: 0 });

            return { carteras: carterasData, totales };

        } catch (error) {
            console.error('Error en getCarterasEncargado:', error);
            throw error;
        }
    },

    // ... existing code
    /**
     * Delete an admin user (Super Admin only)
     * @param {string} id - ID del usuario a eliminar
     */
    deleteUser: async (id) => {
        try {
            // Get current session token for Auth middleware
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al eliminar usuario');
            }

            return result;
        } catch (error) {
            console.error('Error in deleteUser service:', error);
            throw error;
        }
    },

    /**
     * Renew subscription via API
     */
    renewSubscription: async (adminId, renewalData) => {
        try {
            // Get token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${adminId}/subscription/renew`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(renewalData)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error renewing subscription');
            return result;
        } catch (error) {
            console.error('Error in renewSubscription:', error);
            throw error;
        }
    }
};
