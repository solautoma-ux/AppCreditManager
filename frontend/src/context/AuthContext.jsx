import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Verificar sesión actual
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setLoading(false);
            }
        });

        // 2. Escuchar cambios de estado (Login, Logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('🔄 Auth State Changed:', _event);
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (authUser) => {
        try {
            // 1. Intentar buscar por auth_id (Usuario ya vinculado)
            let { data, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('auth_id', authUser.id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile by ID:', error);
            }

            // 2. Si no encuentra por auth_id, INTENTAR VINCULAR POR EMAIL (RPC)
            if (!data) {
                console.log('🔍 Usuario no vinculado por auth_id. Intentando vincular por email (RPC)...', authUser.email);

                // Llamada directa a RPC segura (bypassing RLS)
                const { data: linkedResult, error: linkError } = await supabase
                    .rpc('vincular_cuenta_por_email', { _email: authUser.email });

                if (linkError) {
                    console.error('❌ Error llamando a RPC vinculación:', linkError);
                } else if (linkedResult?.success && linkedResult?.data) {
                    console.log('✅ Cuenta vinculada exitosamente y datos recuperados.');
                    data = linkedResult.data;
                    // Asegurar que auth_id esté seteado en memoria
                    data.auth_id = authUser.id;
                } else {
                    console.warn('⚠️ No se encontró invitación o falló vinculación:', linkedResult?.message);
                }
            }

            // 3. Verificar si tiene suscripción (Auto-repair logic)
            const { data: existingSub } = await supabase
                .from('admin_subscriptions')
                .select('id')
                .eq('admin_id', data.id)
                .maybeSingle();

            // AUTO-ACTIVACIÓN / REPARACIÓN: 
            // Si es admin Y (está pendiente O no tiene suscripción), ejecutar lógica de inicialización
            const needsActivation = data.rol === 'admin' && (data.estado === 'pendiente' || !existingSub);

            if (needsActivation) {
                try {
                    console.log('⚙️ Admin sin suscripción completa detectado, inicializando...');

                    // 1. Definir fechas y montos
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const str_hoy = `${year}-${month}-${day}`; // Fecha local YYYY-MM-DD

                    // Calcular vencimiento (30 días)
                    const date_vencimiento = new Date(year, now.getMonth(), parseInt(day));
                    date_vencimiento.setDate(date_vencimiento.getDate() + 30);

                    const v_year = date_vencimiento.getFullYear();
                    const v_month = String(date_vencimiento.getMonth() + 1).padStart(2, '0');
                    const v_day = String(date_vencimiento.getDate()).padStart(2, '0');
                    const str_vencimiento = `${v_year}-${v_month}-${v_day}`;

                    const int_montoInicial = 50000;
                    const str_mesPagado = `${year}-${month}`;

                    // 2. Crear suscripción si no existe
                    let subscriptionId = existingSub?.id;

                    if (!existingSub) {
                        const { data: newSub, error: subError } = await supabase
                            .from('admin_subscriptions')
                            .insert({
                                admin_id: data.id,
                                tipo_plan: 'mensual',
                                monto_mensual: int_montoInicial,
                                fecha_inicio_suscripcion: str_hoy,
                                fecha_proximo_pago: str_vencimiento,
                                estado_suscripcion: 'activa',
                                dias_mora: 0,
                                total_pagado: int_montoInicial
                            })
                            .select()
                            .single();

                        if (subError) throw subError;
                        subscriptionId = newSub.id;
                        console.log('✅ Suscripción creada exitosamente.');

                        // 3. Registrar pago inicial SOLO si acabamos de crear la suscripción
                        const { error: paymentError } = await supabase
                            .from('subscription_payments')
                            .insert({
                                admin_id: data.id,
                                subscription_id: subscriptionId,
                                monto_pagado: int_montoInicial,
                                fecha_pago: str_hoy,
                                mes_pagado: str_mesPagado,
                                metodo_pago: 'transferencia',
                                notas: 'Pago inicial de activación de cuenta'
                            });

                        if (paymentError) console.error('❌ Error registrando pago inicial:', paymentError);
                        else console.log('✅ Pago inicial registrado.');
                    }

                    // 4. Asegurar estado 'activo' en usuario
                    if (data.estado !== 'activo') {
                        const { error: updateError } = await supabase
                            .from('usuarios')
                            .update({ estado: 'activo' })
                            .eq('id', data.id);

                        if (updateError) throw updateError;
                        data.estado = 'activo';
                        console.log('✅ Usuario marcado como activo.');
                    }

                } catch (activationError) {
                    console.error('❌ Error en auto-activación/reparación:', activationError);
                }
            }

            // Combinar datos de Auth (Google) con datos de nuestra DB
            // Si no hay datos (data is null), el usuario no tiene invitación activa
            setUser({
                ...authUser,
                is_registered: !!data, // Bandera explícita
                rol: data?.rol || null, // Sin rol por defecto
                ...data
            });
        } catch (err) {
            console.error("Profile fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Refreshes the user profile data from the database.
     * Call this after updating user settings to get fresh data.
     */
    const refreshUser = async () => {
        if (session?.user) {
            await fetchProfile(session.user);
        }
    };

    const signInWithGoogle = async (customOptions = {}) => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`,
                    ...customOptions
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error("Error signing in with Google:", error.message);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            setUser(null);
            setSession(null);
        } catch (error) {
            console.error("Error signing out:", error.message);
        }
    };

    const value = {
        user,
        session,
        loading,
        signInWithGoogle,
        signOut,
        refreshUser
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
