import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { sendWelcomeEmail } from '../services/emailService.js';
import * as subscriptionService from '../services/subscriptionService.js';
import { errorHandler } from '../utils/errorHandler.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Get subscription history for a user
 */
export const getSubscriptionDetails = async (req, res) => {
    try {
        const { id: str_id } = req.params;
        const arr_subscriptionHistory = await subscriptionService.getSubscriptionHistory(str_id);
        res.json(arr_subscriptionHistory);
    } catch (error) {
        errorHandler(res, error, 'getSubscriptionDetails');
    }
};

/**
 * Register a subscription payment
 */
export const registerPayment = async (req, res) => {
    try {
        const { id: str_id } = req.params;
        const obj_paymentData = req.body;
        const str_registeredBy = req.user.id; // From auth middleware

        const obj_paymentResult = await subscriptionService.registerSubscriptionPayment(str_id, obj_paymentData, str_registeredBy);
        res.status(201).json(obj_paymentResult);
    } catch (error) {
        errorHandler(res, error, 'registerPayment');
    }
};

/**
 * Invite a new user (Create in DB + Send Email)
 */
export const inviteUser = async (req, res) => {
    try {
        const { email, nombre, apellido, cedula, movil, rol, admin_padre_id } = req.body;
        
        // Asignación con nomenclatura
        let str_email = email;
        const str_nombre = nombre;
        const str_apellido = apellido;
        const str_cedula = cedula;
        const str_movil = movil;
        const str_rol = rol;
        const str_adminPadreId = admin_padre_id;

        // 1. Validation
        if (!str_email || !str_nombre || !str_rol) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        
        str_email = str_email.toLowerCase().trim();

        // 2. Check if user already exists
        const { data: obj_existingUser } = await supabase
            .from('usuarios')
            .select('id')
            .eq('email', str_email)
            .single();

        if (obj_existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado en el sistema.' });
        }

        // 3. Create User in Public Table
        const obj_payload = {
            email: str_email,
            nombre: str_nombre,
            apellido: str_apellido,
            cedula: str_cedula,
            movil: str_movil,
            rol: str_rol,
            estado: 'pendiente',
            created_at: new Date()
        };

        if (str_rol === 'encargado' && str_adminPadreId) {
            obj_payload.admin_padre_id = str_adminPadreId;
        }

        const { data: obj_newUser, error: obj_insertError } = await supabase
            .from('usuarios')
            .insert([obj_payload])
            .select()
            .single();

        if (obj_insertError) {
            throw obj_insertError;
        }

        // 4. Send Welcome Email
        const obj_emailResult = await sendWelcomeEmail(str_email, str_nombre, str_rol);

        if (!obj_emailResult.success) {
            console.warn('Usuario creado pero falló el envío de correo:', obj_emailResult.error);
            return res.status(201).json({
                success: true,
                data: obj_newUser,
                message: 'Usuario creado, pero hubo un error al enviar el correo.'
            });
        }

        return res.status(201).json({
            success: true,
            data: obj_newUser,
            message: 'Usuario creado y notificación enviada.'
        });

    } catch (error) {
        errorHandler(res, error, 'inviteUser');
    }
};

/**
 * Resend invitation email to a pending user
 */
export const resendInvite = async (req, res) => {
    try {
        const { email: str_email } = req.body;

        if (!str_email) {
            return res.status(400).json({ error: 'El email es obligatorio' });
        }

        // Check user existence
        const { data: obj_user } = await supabase
            .from('usuarios')
            .select('id, nombre, rol, estado')
            .eq('email', str_email)
            .single();

        if (!obj_user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (obj_user.estado !== 'pendiente') {
            return res.status(400).json({ error: 'El usuario ya no está en estado pendiente.' });
        }

        // Send Welcome Email
        const obj_emailResult = await sendWelcomeEmail(str_email, obj_user.nombre, obj_user.rol);

        if (!obj_emailResult.success) {
            console.error('Error sending email:', obj_emailResult.error);
            return res.status(500).json({ error: 'Error al enviar el correo' });
        }

        return res.status(200).json({ success: true, message: 'Invitación reenviada correctamente' });

    } catch (error) {
        errorHandler(res, error, 'resendInvite');
    }
};

/**
 * Delete a user safely (Only if no dependencies exist)
 */
export const deleteUser = async (req, res) => {
    try {
        const { id: str_id } = req.params; // User to be deleted
        const str_requestingUserId = req.user.id; // User performing the action

        // 1. Identify Requester Role (Security Check)
        console.log(`[DEBUG] deleteUser requested by: ${str_requestingUserId}`);

        let { data: obj_requesterData, error: obj_requesterError } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', str_requestingUserId)
            .single();

        if (!obj_requesterData) {
            console.log('[DEBUG] Requester missing in public.usuarios. Attempting SMART REPAIR...');

            try {
                // 1. Get Auth Data
                const { data: { user: obj_authUser } } = await supabase.auth.admin.getUserById(str_requestingUserId);

                if (obj_authUser && obj_authUser.email) {
                    // 2. Check for ORPHAN profile by Email
                    const { data: obj_orphanProfile } = await supabase
                        .from('usuarios')
                        .select('*')
                        .eq('email', obj_authUser.email)
                        .single();

                    if (obj_orphanProfile) {
                        console.log(`[FIX] FOUND ORPHAN PROFILE (ID: ${obj_orphanProfile.id}) for Email: ${obj_authUser.email}. Migrating to new ID: ${str_requestingUserId}...`);

                        // 3. Migrate Records
                        await supabase.from('carteras').update({ admin_id: str_requestingUserId }).eq('admin_id', obj_orphanProfile.id);
                        await supabase.from('clientes').update({ admin_id: str_requestingUserId }).eq('admin_id', obj_orphanProfile.id);
                        await supabase.from('usuarios').update({ admin_padre_id: str_requestingUserId }).eq('admin_padre_id', obj_orphanProfile.id);
                        await supabase.from('creditos').update({ creado_por_id: str_requestingUserId }).eq('creado_por_id', obj_orphanProfile.id);
                        await supabase.from('pagos').update({ registrado_por_id: str_requestingUserId }).eq('registrado_por_id', obj_orphanProfile.id);

                        // 4. Update the User Record ID
                        const { error: obj_updateError } = await supabase
                            .from('usuarios')
                            .update({ id: str_requestingUserId, updated_at: new Date() })
                            .eq('id', obj_orphanProfile.id);

                        if (!obj_updateError) {
                            console.log('[FIX] Profile migrated successfully!');
                            obj_requesterData = { ...obj_orphanProfile, id: str_requestingUserId };
                            obj_requesterError = null;
                        } else {
                            console.error('[FIX] Failed to update profile ID:', obj_updateError);
                        }
                    } else {
                        // No orphan profile found. Create brand new one
                        console.log('[FIX] No orphan profile found. Creating new user record...');
                        const { data: obj_newUser, error: obj_insertError } = await supabase
                            .from('usuarios')
                            .insert([{
                                id: str_requestingUserId,
                                email: obj_authUser.email,
                                nombre: obj_authUser.user_metadata?.nombre || 'Usuario Recuperado',
                                rol: 'admin',
                                estado: 'activo'
                            }])
                            .select('rol')
                            .single();

                        if (!obj_insertError) {
                            obj_requesterData = obj_newUser;
                            obj_requesterError = null;
                        }
                    }
                }
            } catch (err) {
                console.error('[FIX] Smart Repair failed:', err);
            }
        }

        if (obj_requesterError || !obj_requesterData) {
            return res.status(403).json({ error: `No autorizado. Usuario solicitante no encontrado. ID: ${str_requestingUserId}` });
        }

        const str_requesterRole = obj_requesterData.rol;

        // 2. Identify Target User (Hierarchy Check)
        const { data: obj_targetUser, error: obj_targetError } = await supabase
            .from('usuarios')
            .select('rol, admin_padre_id, auth_id')
            .eq('id', str_id)
            .single();

        if (obj_targetError || !obj_targetUser) {
            return res.status(404).json({ error: 'Usuario a eliminar no encontrado.' });
        }

        // 3. Authorization Logic
        let bol_isAuthorized = false;

        if (str_requesterRole === 'super_admin') {
            bol_isAuthorized = true; // Super Admin can delete anyone
        } else if (str_requesterRole === 'admin') {
            // Admin can only delete THEIR Encargados
            if (obj_targetUser.rol === 'encargado' && obj_targetUser.admin_padre_id === str_requestingUserId) {
                bol_isAuthorized = true;
            }
        }

        if (!bol_isAuthorized) {
            return res.status(403).json({ error: 'No autorizado para eliminar este usuario.' });
        }

        // 4. Integrity Validations

        // A. If target is ADMIN (or Super Admin)
        if (obj_targetUser.rol === 'admin' || obj_targetUser.rol === 'super_admin') {
            // Check Associated Clients
            const { count: int_clientesCount } = await supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('admin_id', str_id);
            if (int_clientesCount > 0) return res.status(400).json({ error: `No se puede eliminar: El usuario tiene ${int_clientesCount} clientes asociados.` });

            // Check Active Wallets (Carteras)
            const { count: int_carterasCount } = await supabase.from('carteras').select('*', { count: 'exact', head: true }).eq('admin_id', str_id);
            if (int_carterasCount > 0) return res.status(400).json({ error: `No se puede eliminar: El usuario tiene ${int_carterasCount} carteras activas.` });

            // Check Dependent Encargados
            const { count: int_encargadosCount } = await supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('admin_padre_id', str_id);
            if (int_encargadosCount > 0) return res.status(400).json({ error: `No se puede eliminar: El usuario tiene ${int_encargadosCount} encargados bajo su supervisión.` });
        }

        // B. If target is ENCARGADO
        if (obj_targetUser.rol === 'encargado') {
            // Check Created Loans
            const { count: int_creditosCount } = await supabase.from('creditos').select('*', { count: 'exact', head: true }).eq('creado_por_id', str_id);
            if (int_creditosCount > 0) return res.status(400).json({ error: `No se puede eliminar: El encargado ha procesado ${int_creditosCount} créditos.` });

            // Check Registered Payments
            const { count: int_pagosCount } = await supabase.from('pagos').select('*', { count: 'exact', head: true }).eq('registrado_por_id', str_id);
            if (int_pagosCount > 0) return res.status(400).json({ error: `No se puede eliminar: El encargado ha registrado ${int_pagosCount} pagos.` });

            // Check Portfolio Assignments
            const { count: int_asignacionesCount } = await supabase.from('cartera_encargados').select('*', { count: 'exact', head: true }).eq('encargado_id', str_id);
            if (int_asignacionesCount > 0) return res.status(400).json({ error: `No se puede eliminar: El encargado tiene ${int_asignacionesCount} asignaciones de cartera activas. Retírelas primero.` });
        }

        // 5. Execute Delete from Public DB
        const { error: obj_deleteError } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', str_id);

        if (obj_deleteError) throw obj_deleteError;

        // 6. Delete from Auth (Supabase Auth)
        const str_authIdToDelete = obj_targetUser.auth_id || str_id;

        if (str_authIdToDelete) {
            const { error: obj_authDeleteError } = await supabase.auth.admin.deleteUser(str_authIdToDelete);
            if (obj_authDeleteError) {
                console.warn(`Usuario eliminado de DB pública pero falló borrado en Auth (ID: ${str_authIdToDelete}):`, obj_authDeleteError.message);
            } else {
                console.log(`Usuario eliminado correctamente de Auth (ID: ${str_authIdToDelete})`);
            }
        }

        res.json({ success: true, message: 'Usuario eliminado correctamente del sistema.' });

    } catch (error) {
        errorHandler(res, error, 'deleteUser');
    }
};

/**
 * Renew User Subscription
 */
export const renewUserSubscription = async (req, res) => {
    try {
        const { id: str_id } = req.params;
        const { tipo_plan: str_tipoPlan, monto: dbl_monto, dias_duracion: int_diasDuracion } = req.body;
        const str_registeredBy = req.user.id; // From authMiddleware

        if (!str_tipoPlan || !dbl_monto || !int_diasDuracion) {
            return res.status(400).json({ error: 'Faltan datos de renovación (monto, plan, dias)' });
        }

        const obj_result = await subscriptionService.renewSubscription(
            str_id, 
            { tipo_plan: str_tipoPlan, monto: dbl_monto, dias_duracion: int_diasDuracion }, 
            str_registeredBy
        );
        
        res.json({ success: true, data: obj_result, message: 'Suscripción renovada exitosamente' });

    } catch (error) {
        errorHandler(res, error, 'renewUserSubscription');
    }
};

/**
 * Reset completo del sistema.
 */
export const resetCompleto = async (req, res) => {
    try {
        const str_requestingId = req.user.id;

        // 1. Verificar que el solicitante es Super Admin
        const { data: obj_requesterData, error: obj_reqError } = await supabase
            .from('usuarios')
            .select('rol, id')
            .eq('auth_id', str_requestingId)
            .maybeSingle();

        if (obj_reqError || obj_requesterData?.rol !== 'super_admin') {
            return res.status(403).json({ error: 'No autorizado. Solo el Super Admin puede resetear el sistema.' });
        }

        const str_superAdminAuthId = str_requestingId;

        // 2. Ejecutar el reset de tablas en BD pública
        const { data: obj_rpcResult, error: obj_rpcError } = await supabase
            .rpc('reset_sistema_completo', { p_auth_id: str_requestingId });

        if (obj_rpcError) throw obj_rpcError;
        if (obj_rpcResult && !obj_rpcResult.success) throw new Error(obj_rpcResult.message);

        console.log('[RESET] BD pública reseteada:', obj_rpcResult?.message);

        // 3. Listar todos los usuarios de Supabase Auth
        const { data: { users: arr_authUsers }, error: obj_listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });

        if (obj_listError) {
            console.warn('[RESET] No se pudo listar auth.users:', obj_listError.message);
        } else {
            // 4. Borrar de Auth a todos excepto el Super Admin
            let int_borrados = 0;
            let int_errores = 0;

            for (const obj_authUser of arr_authUsers) {
                if (obj_authUser.id === str_superAdminAuthId) continue;

                const { error: obj_deleteAuthError } = await supabase.auth.admin.deleteUser(obj_authUser.id);
                if (obj_deleteAuthError) {
                    console.warn(`[RESET] Error borrando auth user ${obj_authUser.email}:`, obj_deleteAuthError.message);
                    int_errores++;
                } else {
                    int_borrados++;
                }
            }

            console.log(`[RESET] Auth.users limpiados: ${int_borrados} borrados, ${int_errores} errores.`);
        }

        return res.json({
            success: true,
            message: 'Sistema reseteado exitosamente. Solo el Super Admin fue preservado.'
        });

    } catch (error) {
        errorHandler(res, error, 'resetCompleto');
    }
};
