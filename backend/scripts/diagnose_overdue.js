/**
 * Script de diagnóstico para verificar la lógica de vencimientos
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
    const today = new Date().toISOString().split('T')[0];
    console.log('=== DIAGNÓSTICO DE VENCIMIENTOS ===');
    console.log(`Fecha de hoy: ${today}`);
    console.log('');

    // 1. Obtener créditos activos
    const { data: activeCredits, error: errCredits } = await supabase
        .from('creditos')
        .select('id, codigo, estado, fecha_vencimiento, cliente:clientes(nombre)')
        .eq('estado', 'activo');

    if (errCredits) {
        console.error('Error obteniendo créditos:', errCredits);
        return;
    }

    console.log(`Créditos activos encontrados: ${activeCredits?.length || 0}`);
    console.log('');

    for (const credit of activeCredits || []) {
        console.log(`--- Crédito: ${credit.codigo} (${credit.cliente?.nombre}) ---`);
        console.log(`   fecha_vencimiento del crédito: ${credit.fecha_vencimiento}`);

        // Obtener última cuota
        const { data: lastInstallment, error: errInst } = await supabase
            .from('amortizaciones')
            .select('numero_cuota, fecha_vencimiento, estado')
            .eq('credito_id', credit.id)
            .order('numero_cuota', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (errInst) {
            console.log(`   ERROR obteniendo cuotas: ${errInst.message}`);
            continue;
        }

        if (!lastInstallment) {
            console.log('   No tiene cuotas en amortizaciones');
            continue;
        }

        console.log(`   Última cuota (#${lastInstallment.numero_cuota}): ${lastInstallment.fecha_vencimiento}`);
        console.log(`   Estado de cuota: ${lastInstallment.estado}`);

        const isOverdue = lastInstallment.fecha_vencimiento < today;
        console.log(`   ¿Está vencido? ${isOverdue ? 'SÍ' : 'NO'} (${lastInstallment.fecha_vencimiento} < ${today})`);

        if (isOverdue) {
            console.log('   --> Intentando actualizar a vencido...');
            const { error: errUpdate } = await supabase
                .from('creditos')
                .update({ estado: 'vencido', updated_at: new Date().toISOString() })
                .eq('id', credit.id);

            if (errUpdate) {
                console.log(`   ERROR al actualizar: ${errUpdate.message}`);
            } else {
                console.log('   ✓ Actualizado exitosamente a vencido');
            }
        }
        console.log('');
    }

    console.log('=== FIN DIAGNÓSTICO ===');
}

diagnose().catch(console.error);
