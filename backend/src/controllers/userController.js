import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { sendWelcomeEmail } from '../services/emailService.js';
import * as subscriptionService from '../services/subscriptionService.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Get subscription history for a user
 */
export const getSubscriptionDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await subscriptionService.getSubscriptionHistory(id);
        res.json(result);
    } catch (error) {
        console.error('Error fetching subscription details:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Register a subscription payment
 */
export const registerPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const paymentData = req.body;
        const registeredBy = req.user.id; // From auth middleware

        const payment = await subscriptionService.registerSubscriptionPayment(id, paymentData, registeredBy);
        res.status(201).json(payment);
    } catch (error) {
        console.error('Error registering payment:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Invite a new user (Create in DB + Send Email)
 */
export const inviteUser = async (req, res) => {
    try {
        let { email, nombre, apellido, cedula, movil, rol, admin_padre_id } = req.body;
        const creatorId = req.user?.id; // Assuming auth middleware populates this

        // 1. Validation
        if (!email || !nombre || !rol) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        
        email = email.toLowerCase().trim();

        // 2. Check if user already exists
        const { data: existingUser } = await supabase
            .from('usuarios')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado en el sistema.' });
        }

        // 3. Create User in Public Table
        const payload = {
            email,
            nombre,
            apellido,
            cedula,
            movil,
            rol,
            estado: 'pendiente',
            // admin_padre_id is optional, depends on logic
            created_at: new Date()
        };

        if (rol === 'encargado' && admin_padre_id) {
            payload.admin_padre_id = admin_padre_id;
        }

        const { data: newUser, error: insertError } = await supabase
            .from('usuarios')
            .insert([payload])
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        // 4. Send Welcome Email
        // We don't await this to keep response fast, or we can await if we want to confirm sending
        const emailResult = await sendWelcomeEmail(email, nombre, rol);

        if (!emailResult.success) {
            console.warn('Usuario creado pero falló el envío de correo:', emailResult.error);
            return res.status(201).json({
                success: true,
                data: newUser,
                message: 'Usuario creado, pero hubo un error al enviar el correo.'
            });
        }

        return res.status(201).json({
            success: true,
            data: newUser,
            message: 'Usuario creado y notificación enviada.'
        });

    } catch (error) {
        console.error('Error in inviteUser:', error);
        return res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
};

/**
 * Resend invitation email to a pending user
 */
export const resendInvite = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'El email es obligatorio' });
        }

        // Check user existence
        const { data: user } = await supabase
            .from('usuarios')
            .select('id, nombre, rol, estado')
            .eq('email', email)
            .single();

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (user.estado !== 'pendiente') {
            return res.status(400).json({ error: 'El usuario ya no está en estado pendiente.' });
        }

        // Send Welcome Email
        const emailResult = await sendWelcomeEmail(email, user.nombre, user.rol);

        if (!emailResult.success) {
            console.error('Error sending email:', emailResult.error);
            return res.status(500).json({ error: 'Error al enviar el correo' });
        }

        return res.status(200).json({ success: true, message: 'Invitación reenviada correctamente' });

    } catch (error) {
        console.error('Error in resendInvite:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Delete a user safely (Only if no dependencies exist)
 */
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params; // User to be deleted
        const requestingUserId = req.user.id; // User performing the action

        // 1. Identify Requester Role (Security Check)
        console.log(`[DEBUG] deleteUser requested by: ${requestingUserId}`);

        const { data: requesterData, error: requesterError } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', requestingUserId)
            .single();

        if (!requesterData) {
            console.log('[DEBUG] Requester missing in public.usuarios. Attempting SMART REPAIR...');

            try {
                // 1. Get Auth Data
                const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(requestingUserId);

                if (authUser && authUser.email) {
                    // 2. Check for ORPHAN profile by Email
                    const { data: orphanProfile } = await supabase
                        .from('usuarios')
                        .select('*')
                        .eq('email', authUser.email)
                        .single();

                    if (orphanProfile) {
                        console.log(`[FIX] FOUND ORPHAN PROFILE (ID: ${orphanProfile.id}) for Email: ${authUser.email}. Migrating to new ID: ${requestingUserId}...`);

                        // 3. Migrate Records (Update FKs manually to be safe against non-cascading FKs)
                        await supabase.from('carteras').update({ admin_id: requestingUserId }).eq('admin_id', orphanProfile.id);
                        await supabase.from('clientes').update({ admin_id: requestingUserId }).eq('admin_id', orphanProfile.id);
                        await supabase.from('usuarios').update({ admin_padre_id: requestingUserId }).eq('admin_padre_id', orphanProfile.id);
                        await supabase.from('creditos').update({ creado_por_id: requestingUserId }).eq('creado_por_id', orphanProfile.id);
                        await supabase.from('pagos').update({ registrado_por_id: requestingUserId }).eq('registrado_por_id', orphanProfile.id);

                        // 4. Update the User Record ID
                        const { error: updateError } = await supabase
                            .from('usuarios')
                            .update({ id: requestingUserId, updated_at: new Date() })
                            .eq('id', orphanProfile.id);

                        if (!updateError) {
                            console.log('[FIX] Profile migrated successfully!');
                            requesterData = { ...orphanProfile, id: requestingUserId };
                            requesterError = null;
                        } else {
                            console.error('[FIX] Failed to update profile ID:', updateError);
                        }
                    } else {
                        // No orphan profile found. Create brand new one (Lazy Sync).
                        console.log('[FIX] No orphan profile found. Creating new user record...');
                        const { data: newUser, error: insertError } = await supabase
                            .from('usuarios')
                            .insert([{
                                id: requestingUserId,
                                email: authUser.email,
                                nombre: authUser.user_metadata?.nombre || 'Usuario Recuperado',
                                rol: 'admin',
                                estado: 'activo'
                            }])
                            .select('rol')
                            .single();

                        if (!insertError) {
                            requesterData = newUser;
                            requesterError = null;
                        }
                    }
                }
            } catch (err) {
                console.error('[FIX] Smart Repair failed:', err);
            }
        }

        if (requesterError || !requesterData) {
            return res.status(403).json({ error: `No autorizado. Usuario solicitante no encontrado. ID: ${requestingUserId}` });
        }

        const requesterRole = requesterData.rol;

        // 2. Identify Target User (Hierarchy Check)
        const { data: targetUser, error: targetError } = await supabase
            .from('usuarios')
            .select('rol, admin_padre_id, auth_id')
            .eq('id', id)
            .single();

        if (targetError || !targetUser) {
            return res.status(404).json({ error: 'Usuario a eliminar no encontrado.' });
        }

        // 3. Authorization Logic
        let isAuthorized = false;

        if (requesterRole === 'super_admin') {
            isAuthorized = true; // Super Admin can delete anyone (subject to integrity checks)
        } else if (requesterRole === 'admin') {
            // Admin can only delete THEIR Encargados
            if (targetUser.rol === 'encargado' && targetUser.admin_padre_id === requestingUserId) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: 'No autorizado para eliminar este usuario.' });
        }

        // 4. Integrity Validations

        // A. If target is ADMIN (or Super Admin)
        if (targetUser.rol === 'admin' || targetUser.rol === 'super_admin') {
            // Check Associated Clients
            const { count: clientesCount } = await supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('admin_id', id);
            if (clientesCount > 0) return res.status(400).json({ error: `No se puede eliminar: El usuario tiene ${clientesCount} clientes asociados.` });

            // Check Active Wallets (Carteras)
            const { count: carterasCount } = await supabase.from('carteras').select('*', { count: 'exact', head: true }).eq('admin_id', id);
            if (carterasCount > 0) return res.status(400).json({ error: `No se puede eliminar: El usuario tiene ${carterasCount} carteras activas.` });

            // Check Dependent Encargados
            const { count: encargadosCount } = await supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('admin_padre_id', id);
            if (encargadosCount > 0) return res.status(400).json({ error: `No se puede eliminar: El usuario tiene ${encargadosCount} encargados bajo su supervisión.` });
        }

        // B. If target is ENCARGADO
        if (targetUser.rol === 'encargado') {
            // Check Created Loans
            const { count: creditosCount } = await supabase.from('creditos').select('*', { count: 'exact', head: true }).eq('creado_por_id', id);
            if (creditosCount > 0) return res.status(400).json({ error: `No se puede eliminar: El encargado ha procesado ${creditosCount} créditos.` });

            // Check Registered Payments
            const { count: pagosCount } = await supabase.from('pagos').select('*', { count: 'exact', head: true }).eq('registrado_por_id', id);
            if (pagosCount > 0) return res.status(400).json({ error: `No se puede eliminar: El encargado ha registrado ${pagosCount} pagos.` });

            // Check Portfolio Assignments
            const { count: asignacionesCount } = await supabase.from('cartera_encargados').select('*', { count: 'exact', head: true }).eq('encargado_id', id);
            if (asignacionesCount > 0) return res.status(400).json({ error: `No se puede eliminar: El encargado tiene ${asignacionesCount} asignaciones de cartera activas. Retírelas primero.` });
        }

        // 5. Execute Delete
        // 5. Execute Delete from Public DB
        const { error: deleteError } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // 6. Delete from Auth (Supabase Auth)
        // Use auth_id if available (linked account), otherwise try PK id
        const authIdToDelete = targetUser.auth_id || id;

        if (authIdToDelete) {
            const { error: authDeleteError } = await supabase.auth.admin.deleteUser(authIdToDelete);
            if (authDeleteError) {
                console.warn(`Usuario eliminado de DB pública pero falló borrado en Auth (ID: ${authIdToDelete}):`, authDeleteError.message);
            } else {
                console.log(`Usuario eliminado correctamente de Auth (ID: ${authIdToDelete})`);
            }
        }

        res.json({ success: true, message: 'Usuario eliminado correctamente del sistema.' });

        // ... existing code

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Renew User Subscription
 */
export const renewUserSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo_plan, monto, dias_duracion } = req.body;
        const registeredBy = req.user.id; // From authMiddleware

        if (!tipo_plan || !monto || !dias_duracion) {
            return res.status(400).json({ error: 'Faltan datos de renovación (monto, plan, dias)' });
        }

        const result = await subscriptionService.renewSubscription(id, { tipo_plan, monto, dias_duracion }, registeredBy);
        res.json({ success: true, data: result, message: 'Suscripción renovada exitosamente' });

    } catch (error) {
        console.error('Error renewing subscription:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reset completo del sistema.
 * Borra todas las tablas transaccionales y usuarios (excecto el Super Admin)
 * desde la BD pública (vía RPC) y también de Supabase Auth (vía service_role).
 * Solo puede ser invocado por un Super Admin autenticado.
 */
export const resetCompleto = async (req, res) => {
    try {
        const str_requestingId = req.user.id;

        // 1. Verificar que el solicitante es Super Admin
        const { data: requesterData, error: reqError } = await supabase
            .from('usuarios')
            .select('rol, id')
            .eq('auth_id', str_requestingId)
            .maybeSingle();

        if (reqError || requesterData?.rol !== 'super_admin') {
            return res.status(403).json({ error: 'No autorizado. Solo el Super Admin puede resetear el sistema.' });
        }

        const str_superAdminAuthId = str_requestingId;

        // 2. Ejecutar el reset de tablas en BD pública (RPC maneja el borrado de usuarios y datos)
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('reset_sistema_completo');

        if (rpcError) throw rpcError;
        if (rpcResult && !rpcResult.success) throw new Error(rpcResult.message);

        console.log('[RESET] BD pública reseteada:', rpcResult?.message);

        // 3. Listar todos los usuarios de Supabase Auth
        const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });

        if (listError) {
            console.warn('[RESET] No se pudo listar auth.users:', listError.message);
        } else {
            // 4. Borrar de Auth a todos excepto el Super Admin
            let int_borrados = 0;
            let int_errores = 0;

            for (const authUser of authUsers) {
                if (authUser.id === str_superAdminAuthId) continue; // Preservar Super Admin

                const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);
                if (deleteAuthError) {
                    console.warn(`[RESET] Error borrando auth user ${authUser.email}:`, deleteAuthError.message);
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
        console.error('[RESET] Error en resetCompleto:', error);
        return res.status(500).json({ error: error.message || 'Error interno al resetear el sistema.' });
    }
};
