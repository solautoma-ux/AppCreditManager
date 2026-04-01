import { supabase } from './supabaseClient';

/**
 * Service for Credit Logic and Data
 */
export const creditoService = {
    /**
     * Simulates the amortization schedule (Fixed/Flat Interest)
     * @param {number} capital - Monto prestado
     * @param {number} tasa - Porcentaje de interés (fijo total)
     * @param {number} numeroCuotas - Cantidad de cuotas
     * @param {string} frecuencia - diaria, semanal, quincenal, mensual
     * @param {Date} fechaInicio 
     */
    simularCredito: (capital, tasa, numeroCuotas, frecuencia, fechaInicio) => {
        const montoCapital = parseFloat(capital);
        const tasaInteres = parseFloat(tasa);
        const numCuotas = parseInt(numeroCuotas);

        if (!montoCapital || !numCuotas) return [];

        // Cálculo Interés Fijo (Opción A: Flat Rate)
        // El interés se calcula sobre el capital inicial para todo el periodo (o el input ya es el % total)
        // Asumimos que 'tasa' es el porcentaje de ganancia total sobre el préstamo.
        const totalInteres = montoCapital * (tasaInteres / 100);
        const montoTotal = montoCapital + totalInteres;
        const valorCuota = montoTotal / numCuotas;

        // Distribución contable (para reportes internos)
        // Usualmente en cuota fija se prorratea
        const capitalPorCuota = montoCapital / numCuotas;
        const interesPorCuota = totalInteres / numCuotas;

        let cuotas = [];
        let currentDate = new Date(fechaInicio);

        // Mapa de días a sumar
        const diasPorFrecuencia = {
            'diaria': 1,
            'semanal': 7,
            'quincenal': 15,
            'mensual': 30,
            'unico': 0
        };
        const diasSumar = diasPorFrecuencia[frecuencia] || 1;

        for (let i = 1; i <= numCuotas; i++) {
            // Calcular fecha vencimiento
            // Si es 'diaria', excluimos domingos? (Lógica avanzada, por ahora simple +1 dia)
            let fechaVenc = new Date(currentDate);
            if (frecuencia !== 'unico') {
                fechaVenc.setDate(fechaVenc.getDate() + (diasSumar * i));
            } else {
                // Si es unico, asumimos un mes o la fecha que elijan (falta input de fecha fin en UI simple)
                // Por defecto 30 dias si es unico
                fechaVenc.setDate(fechaVenc.getDate() + 30);
            }

            cuotas.push({
                numero: i,
                fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
                monto_cuota: valorCuota,
                capital: capitalPorCuota,
                interes: interesPorCuota,
                saldo_pendiente: montoTotal - (valorCuota * i) // Referencial visual
            });
        }

        return {
            cuotas,
            totales: {
                capital: montoCapital,
                interes: totalInteres,
                total: montoTotal,
                valorCuota: valorCuota
            }
        };
    },

    /**
     * Create Credit Transaction via RPC
     */
    createCredito: async (creditoData) => {
        // Preparar payload para la funcion SQL
        const {
            admin_id, cartera_id, cliente_id,
            monto_capital, tasa_interes,
            frecuencia, fecha_inicio,
            simulation // viene del paso anterior
        } = creditoData;

        // Validar simulacion y tipos
        if (!simulation || !simulation.totales) {
            throw new Error("Datos de simulación inválidos");
        }

        const payload = {
            p_admin_id: admin_id,
            p_cartera_id: cartera_id,
            p_cliente_id: cliente_id,
            p_monto_capital: parseFloat(monto_capital),
            p_tasa_interes: parseFloat(tasa_interes),
            p_monto_interes_calculado: parseFloat(simulation.totales.interes),
            p_monto_total: parseFloat(simulation.totales.total),
            p_plazo_numero: simulation.cuotas.length, // Usamos cuotas como "plazo numero"
            p_plazo_unidad: frecuencia === 'mensual' ? 'meses' : 'dias',
            p_frecuencia_pago: frecuencia,
            p_numero_cuotas: simulation.cuotas.length,
            p_monto_cuota: parseFloat(simulation.totales.valorCuota),
            p_fecha_inicio: fecha_inicio,
            p_fecha_vencimiento: simulation.cuotas[simulation.cuotas.length - 1].fecha_vencimiento,
            p_cuotas_json: simulation.cuotas
        };

        const { data, error } = await supabase.rpc('crear_credito_completo', payload);

        if (error) throw error;
        return data;
    },

    /**
     * Get Credits List and verify overdue ones
     */
    getCreditos: async () => {
        try {
            // First verify overdue loans (lazy update)
            await creditoService.verificarVencimientos();

            const { data, error } = await supabase
                .from('creditos')
                .select(`
                    *,
                    cliente:clientes(nombre, apellido, cedula, movil),
                    cartera:carteras(nombre)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in getCreditos:', error);
            throw error;
        }
    },

    /**
     * Verifies if any active credit has passed its due date (based on the last installment)
     * and updates its state to 'vencido'.
     */
    verificarVencimientos: async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Obtener créditos activos
            const { data: activeCredits, error: errCredits } = await supabase
                .from('creditos')
                .select('id')
                .eq('estado', 'activo');

            if (errCredits || !activeCredits || activeCredits.length === 0) {
                return { success: true, updated_count: 0 };
            }

            const overdueIds = [];

            // 2. Para cada crédito, obtener la última cuota y verificar si ya pasó
            for (const credit of activeCredits) {
                const { data: lastInstallment, error: errInst } = await supabase
                    .from('amortizaciones')
                    .select('fecha_vencimiento')
                    .eq('credito_id', credit.id)
                    .order('numero_cuota', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastInstallment && lastInstallment.fecha_vencimiento < today) {
                    overdueIds.push(credit.id);
                }
            }

            if (overdueIds.length === 0) return { success: true, updated_count: 0 };

            // 3. Actualizar estado a vencido
            const { error: errUpdate } = await supabase
                .from('creditos')
                .update({ estado: 'vencido', updated_at: new Date().toISOString() })
                .in('id', overdueIds);

            if (errUpdate) throw errUpdate;
            console.log(`[Vencimientos] Updated ${overdueIds.length} credits to 'vencido'.`);
            return { success: true, updated_count: overdueIds.length };
        } catch (error) {
            console.error('Error verifying overdue credits:', error);
            return { success: false, error };
        }
    },

    /**
     * Refinance a credit using RPC
     */
    refinanciarCredito: async (originalCreditoId, newCreditoData) => {
        const {
            admin_id, cartera_id,
            monto_capital, tasa_interes,
            frecuencia, fecha_inicio,
            simulation
        } = newCreditoData;

        const payload = {
            p_credito_id: originalCreditoId,
            p_admin_id: admin_id,
            p_cartera_id: cartera_id,
            p_monto_capital: parseFloat(monto_capital),
            p_tasa_interes: parseFloat(tasa_interes),
            p_monto_interes_calculado: parseFloat(simulation.totales.interes),
            p_monto_total: parseFloat(simulation.totales.total),
            p_plazo_numero: simulation.cuotas.length,
            p_plazo_unidad: frecuencia === 'mensual' ? 'meses' : 'dias',
            p_frecuencia_pago: frecuencia,
            p_numero_cuotas: simulation.cuotas.length,
            p_monto_cuota: parseFloat(simulation.totales.valorCuota),
            p_fecha_inicio: fecha_inicio,
            p_fecha_vencimiento: simulation.cuotas[simulation.cuotas.length - 1].fecha_vencimiento,
            p_cuotas_json: simulation.cuotas
        };

        const { data, error } = await supabase.rpc('refinanciar_credito', payload);
        if (error) throw error;
        return data;
    },



    /**
     * Safe Delete a Credit via RPC.
     * Only succeeds if the credit has NO associated payments.
     * @returns {{ success: boolean, message: string }}
     */
    deleteCreditoSeguro: async (creditoId) => {
        try {
            const { data, error } = await supabase.rpc('eliminar_credito_seguro', {
                p_credito_id: creditoId
            });

            if (error) throw error;
            return data; // { success: boolean, message: string }
        } catch (error) {
            console.error('Error deleting credito:', error);
            throw error;
        }
    },

    /**
     * Force Liquidate a Credit (Write Off) via RPC.
     * Zeros all balances and marks as 'interrumpido'.
     * Returns unpaid capital to the wallet.
     * @returns {{ success: boolean, message: string, resumen: object }}
     */
    liquidarCreditoForzado: async (creditoId) => {
        try {
            const { data, error } = await supabase.rpc('liquidar_credito_forzado', {
                p_credito_id: creditoId
            });

            if (error) throw error;
            return data; // { success: boolean, message: string, resumen: {...} }
        } catch (error) {
            console.error('Error liquidating credito:', error);
            throw error;
        }
    },

    /**
     * Search for ACTIVE or OVERDUE credits by client name/document.
     * Used for the Global Payment Wizard.
     * @param {string} term - Search term (name, last name, or document)
     * @returns {Promise<Array>} List of found credits with client info
     */
    buscarCreditosPorCliente: async (term) => {
        if (!term || term.length < 2) return [];

        try {
            // We search in the 'creditos' table where the related 'clientes' matches the term.
            // Using !inner to filter credits based on client properties.
            // We also filter by credit state (active or overdue or refinanced? usually just active/overdue for payment)
            const { data, error } = await supabase
                .from('creditos')
                .select(`
                    *,
                    cliente:clientes!inner(id, nombre, apellido, cedula, movil),
                    cartera:carteras(nombre)
                `)
                .or(`nombre.ilike.%${term}%,apellido.ilike.%${term}%,cedula.ilike.%${term}%`, { foreignTable: 'clientes' })
                .in('estado', ['activo', 'vencido'])
                .order('fecha_vencimiento', { ascending: true }) // Oldest first (priority to pay)
                .limit(20);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error searching credits:', error);
            throw error;
        }
    },

    /**
     * Get ALL credits for a specific client (Active and History)
     * @param {string} clienteId
     */
    getCreditosByCliente: async (clienteId) => {
        if (!clienteId) return [];
        try {
            const { data, error } = await supabase
                .from('creditos')
                .select(`
                    *,
                    cliente:clientes(id, nombre, apellido, cedula),
                    cartera:carteras(id, nombre)
                `)
                .eq('cliente_id', clienteId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching client credits:', error);
            throw error;
        }
    }
};
