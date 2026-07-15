import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// En el backend usamos el service role key para realizar operaciones atómicas de forma segura
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const simularCredito = (dbl_capital, dbl_tasa, int_numeroCuotas, str_frecuencia, str_fechaInicio) => {
    if (!dbl_capital || !int_numeroCuotas) return null;

    const dbl_totalInteres = dbl_capital * (dbl_tasa / 100);
    const dbl_montoTotal = dbl_capital + dbl_totalInteres;
    const dbl_valorCuota = dbl_montoTotal / int_numeroCuotas;

    const dbl_capitalPorCuota = dbl_capital / int_numeroCuotas;
    const dbl_interesPorCuota = dbl_totalInteres / int_numeroCuotas;

    let arr_cuotas = [];
    let date_current = new Date(str_fechaInicio);

    const obj_diasPorFrecuencia = {
        'diaria': 1,
        'semanal': 7,
        'quincenal': 15,
        'mensual': 30,
        'unico': 0
    };
    const int_diasSumar = obj_diasPorFrecuencia[str_frecuencia] || 1;

    for (let i = 1; i <= int_numeroCuotas; i++) {
        let date_venc = new Date(date_current);
        if (str_frecuencia !== 'unico') {
            date_venc.setDate(date_venc.getDate() + (int_diasSumar * i));
        } else {
            date_venc.setDate(date_venc.getDate() + 30);
        }

        arr_cuotas.push({
            numero: i,
            fecha_vencimiento: date_venc.toISOString().split('T')[0],
            monto_cuota: dbl_valorCuota,
            capital: dbl_capitalPorCuota,
            interes: dbl_interesPorCuota,
            saldo_pendiente: dbl_montoTotal - (dbl_valorCuota * i)
        });
    }

    return {
        cuotas: arr_cuotas,
        totales: {
            capital: dbl_capital,
            interes: dbl_totalInteres,
            total: dbl_montoTotal,
            valorCuota: dbl_valorCuota
        }
    };
};

export const createCredito = async (obj_creditoData, str_adminId) => {
    try {
        const {
            cartera_id, cliente_id,
            monto_capital, tasa_interes,
            frecuencia, fecha_inicio,
            numero_cuotas
        } = obj_creditoData;

        // 1. Calcular cuotas internamente (SEGURIDAD)
        const obj_simulation = simularCredito(
            parseFloat(monto_capital),
            parseFloat(tasa_interes),
            parseInt(numero_cuotas),
            frecuencia,
            fecha_inicio
        );

        if (!obj_simulation || !obj_simulation.totales) {
            throw new Error("No se pudo calcular la simulación del crédito.");
        }

        // 2. Preparar Payload para DB
        const obj_payload = {
            p_admin_id: str_adminId,
            p_cartera_id: cartera_id,
            p_cliente_id: cliente_id,
            p_monto_capital: parseFloat(monto_capital),
            p_tasa_interes: parseFloat(tasa_interes),
            p_monto_interes_calculado: parseFloat(obj_simulation.totales.interes),
            p_monto_total: parseFloat(obj_simulation.totales.total),
            p_plazo_numero: obj_simulation.cuotas.length,
            p_plazo_unidad: frecuencia === 'mensual' ? 'meses' : 'dias',
            p_frecuencia_pago: frecuencia,
            p_numero_cuotas: obj_simulation.cuotas.length,
            p_monto_cuota: parseFloat(obj_simulation.totales.valorCuota),
            p_fecha_inicio: fecha_inicio,
            p_fecha_vencimiento: obj_simulation.cuotas[obj_simulation.cuotas.length - 1].fecha_vencimiento,
            p_cuotas_json: obj_simulation.cuotas
        };

        const { data: obj_data, error: obj_error } = await supabase.rpc('crear_credito_completo', obj_payload);

        if (obj_error) throw obj_error;
        return obj_data;
    } catch (error) {
        throw error;
    }
};

/**
 * Servicio para procesar la refinanciación de un crédito en la base de datos.
 * Calcula las nuevas cuotas y llama al procedimiento almacenado para aplicar el cambio.
 * @param {string} str_originalCreditoId - ID del crédito que será refinanciado.
 * @param {Object} obj_newCreditoData - Datos del nuevo crédito (capital, tasa, cuotas, etc).
 * @param {string} str_adminId - ID del administrador que autoriza la operación.
 * @returns {Promise<Object>} Resultado de la refinanciación con los IDs correspondientes.
 */
export const refinanciarCredito = async (str_originalCreditoId, obj_newCreditoData, str_adminId) => {
    try {
        const {
            cartera_id,
            monto_capital, tasa_interes,
            frecuencia, fecha_inicio,
            numero_cuotas
        } = obj_newCreditoData;

        // 1. Calcular cuotas internamente (SEGURIDAD)
        const obj_simulation = simularCredito(
            parseFloat(monto_capital),
            parseFloat(tasa_interes),
            parseInt(numero_cuotas),
            frecuencia,
            fecha_inicio
        );

        if (!obj_simulation || !obj_simulation.totales) {
            throw new Error("No se pudo calcular la simulación de refinanciación.");
        }

        const obj_payload = {
            p_credito_id: str_originalCreditoId,
            p_admin_id: str_adminId,
            p_cartera_id: cartera_id,
            p_monto_capital: parseFloat(monto_capital),
            p_tasa_interes: parseFloat(tasa_interes),
            p_monto_interes_calculado: parseFloat(obj_simulation.totales.interes),
            p_monto_total: parseFloat(obj_simulation.totales.total),
            p_plazo_numero: obj_simulation.cuotas.length,
            p_plazo_unidad: frecuencia === 'mensual' ? 'meses' : 'dias',
            p_frecuencia_pago: frecuencia,
            p_numero_cuotas: obj_simulation.cuotas.length,
            p_monto_cuota: parseFloat(obj_simulation.totales.valorCuota),
            p_fecha_inicio: fecha_inicio,
            p_fecha_vencimiento: obj_simulation.cuotas[obj_simulation.cuotas.length - 1].fecha_vencimiento,
            p_cuotas_json: obj_simulation.cuotas
        };

        const { data: obj_data, error: obj_error } = await supabase.rpc('refinanciar_credito', obj_payload);
        if (obj_error) throw obj_error;
        return obj_data;
    } catch (error) {
        throw error;
    }
};

export const updateCredito = async (str_creditoId, obj_updates, str_adminId) => {
    try {
        const obj_allowedUpdates = {};
        if (obj_updates.notas !== undefined) obj_allowedUpdates.notas = obj_updates.notas;

        const { data: obj_data, error: obj_error } = await supabase
            .from('creditos')
            .update(obj_allowedUpdates)
            .eq('id', str_creditoId)
            .eq('admin_id', str_adminId) // Rule #2
            .select()
            .single();

        if (obj_error) throw obj_error;
        return { success: true, data: obj_data };
    } catch (error) {
        throw error;
    }
};

/**
 * NEW METHODS MIGRATED FROM FRONTEND
 */

export const verificarVencimientos = async (str_adminId) => {
    try {
        const str_today = new Date().toISOString().split('T')[0];

        // 1. Obtener créditos activos del admin
        const { data: arr_activeCredits, error: obj_errCredits } = await supabase
            .from('creditos')
            .select('id')
            .eq('estado', 'activo')
            .eq('admin_id', str_adminId);

        if (obj_errCredits || !arr_activeCredits || arr_activeCredits.length === 0) {
            return { success: true, updated_count: 0 };
        }

        const arr_overdueIds = [];

        // 2. Verificar la última cuota
        for (const obj_credit of arr_activeCredits) {
            const { data: obj_lastInstallment } = await supabase
                .from('amortizaciones')
                .select('fecha_vencimiento')
                .eq('credito_id', obj_credit.id)
                .order('numero_cuota', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (obj_lastInstallment && obj_lastInstallment.fecha_vencimiento < str_today) {
                arr_overdueIds.push(obj_credit.id);
            }
        }

        if (arr_overdueIds.length === 0) return { success: true, updated_count: 0 };

        // 3. Actualizar a vencido
        const { error: obj_errUpdate } = await supabase
            .from('creditos')
            .update({ estado: 'vencido', updated_at: new Date().toISOString() })
            .in('id', arr_overdueIds);

        if (obj_errUpdate) throw obj_errUpdate;
        
        console.log(`[Vencimientos] Admin ${str_adminId}: Updated ${arr_overdueIds.length} credits to 'vencido'.`);
        return { success: true, updated_count: arr_overdueIds.length };
    } catch (error) {
        throw error;
    }
};

export const getCreditos = async (str_adminId) => {
    try {
        // Ejecutar verificación lazy primero
        await verificarVencimientos(str_adminId);

        const { data: arr_data, error: obj_error } = await supabase
            .from('creditos')
            .select(`
                *,
                cliente:clientes(nombre, apellido, cedula, movil),
                cartera:carteras(nombre)
            `)
            .eq('admin_id', str_adminId) // Rule #2
            .order('created_at', { ascending: false });

        if (obj_error) throw obj_error;
        return arr_data;
    } catch (error) {
        throw error;
    }
};

export const getCreditosByCliente = async (str_clienteId, str_adminId) => {
    if (!str_clienteId) return [];
    try {
        const { data: arr_data, error: obj_error } = await supabase
            .from('creditos')
            .select(`
                *,
                cliente:clientes(id, nombre, apellido, cedula),
                cartera:carteras(id, nombre)
            `)
            .eq('cliente_id', str_clienteId)
            .eq('admin_id', str_adminId) // Rule #2
            .order('created_at', { ascending: false });

        if (obj_error) throw obj_error;
        return arr_data;
    } catch (error) {
        throw error;
    }
};

export const buscarCreditosPorCliente = async (str_term, str_adminId) => {
    if (!str_term || str_term.length < 2) return [];

    try {
        const { data: arr_data, error: obj_error } = await supabase
            .from('creditos')
            .select(`
                *,
                cliente:clientes!inner(id, nombre, apellido, cedula, movil),
                cartera:carteras(nombre)
            `)
            .eq('admin_id', str_adminId) // Rule #2
            .or(`nombre.ilike.%${str_term}%,apellido.ilike.%${str_term}%,cedula.ilike.%${str_term}%`, { foreignTable: 'clientes' })
            .in('estado', ['activo', 'vencido'])
            .order('fecha_vencimiento', { ascending: true })
            .limit(20);

        if (obj_error) throw obj_error;
        return arr_data;
    } catch (error) {
        throw error;
    }
};

export const deleteCreditoSeguro = async (str_creditoId, str_adminId, str_userRol) => {
    try {
        // Validación de permisos
        if (str_userRol !== 'super_admin' && str_userRol !== 'admin') {
            throw new Error('No autorizado. Solo los administradores pueden eliminar créditos.');
        }

        // Verificar propiedad
        const { data: obj_check } = await supabase
            .from('creditos')
            .select('id')
            .eq('id', str_creditoId)
            .eq('admin_id', str_adminId)
            .single();

        if (!obj_check) throw new Error('Crédito no encontrado o no pertenece a tu administración.');

        const { data: obj_data, error: obj_error } = await supabase.rpc('eliminar_credito_seguro', {
            p_credito_id: str_creditoId
        });

        if (obj_error) throw obj_error;
        return obj_data;
    } catch (error) {
        throw error;
    }
};

export const liquidarCreditoForzado = async (str_creditoId, str_adminId, str_userRol) => {
    try {
        // Validación de permisos
        if (str_userRol !== 'super_admin' && str_userRol !== 'admin') {
            throw new Error('No autorizado. Solo los administradores pueden liquidar créditos.');
        }

        // Verificar propiedad
        const { data: obj_check } = await supabase
            .from('creditos')
            .select('id')
            .eq('id', str_creditoId)
            .eq('admin_id', str_adminId)
            .single();

        if (!obj_check) throw new Error('Crédito no encontrado o no pertenece a tu administración.');

        const { data: obj_data, error: obj_error } = await supabase.rpc('liquidar_credito_forzado', {
            p_credito_id: str_creditoId
        });

        if (obj_error) throw obj_error;
        return obj_data;
    } catch (error) {
        throw error;
    }
};
