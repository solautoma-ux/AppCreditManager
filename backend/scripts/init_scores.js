import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Env Variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncScores() {
    console.log('🔄 Sincronizando Scores de Clientes...');

    try {
        // 1. Get All Clients
        const { data: clientes, error: errC } = await supabase.from('clientes').select('id, nombre');
        if (errC) throw errC;

        console.log(`🔍 Analizando ${clientes.length} clientes...`);

        for (const client of clientes) {
            // 2. Get Payment Behavior
            // We need all amortizations that should have been paid by now
            const today = new Date().toISOString().split('T')[0];

            // Use updated_at as proxy for payment date since fecha_pago_real doesn't exist yet
            const { data: amortizaciones, error: errA } = await supabase
                .from('amortizaciones')
                .select('id, estado, fecha_vencimiento, updated_at, credito:creditos!inner(cliente_id, estado)')
                .eq('credito.cliente_id', client.id)
                .or(`estado.eq.pagada,fecha_vencimiento.lt.${today}`);

            if (errA) {
                console.error(`Error fetching amorts for ${client.nombre}:`, errA);
                continue;
            }

            // 3. Calculate Score
            let totalExigibles = 0;
            let pagosATiempo = 0;
            let hasInterrupted = false;

            amortizaciones.forEach(a => {
                // Check if the credit is interrupted
                if (a.credito && a.credito.estado === 'interrumpido') {
                    hasInterrupted = true;
                }

                const isVencida = new Date(a.fecha_vencimiento) < new Date(today) && a.estado !== 'pagada';
                const isPagada = a.estado === 'pagada';

                // Validar si cuenta como 'exigible' (ya pasó fecha o ya pagó)
                if (isPagada || isVencida) {
                    totalExigibles++;

                    // Chequear puntualidad
                    if (isPagada) {
                        const fechaVenc = new Date(a.fecha_vencimiento).getTime();
                        const fechaPago = new Date(a.updated_at).getTime(); // Proxy
                        // Buffer de 1 dia para tolerancia
                        const tolerance = 24 * 60 * 60 * 1000;
                        if (fechaPago <= (fechaVenc + tolerance)) {
                            pagosATiempo++;
                        }
                    }
                }
            });

            let newScore = 100;
            if (hasInterrupted) {
                newScore = 0;
            } else if (totalExigibles > 0) {
                newScore = Math.round((pagosATiempo / totalExigibles) * 100);
            }

            let newColor = 'verde';
            if (newScore < 60) newColor = 'rojo';
            else if (newScore < 90) newColor = 'amarillo';

            console.log(`👤 ${client.nombre}: ${pagosATiempo}/${totalExigibles} -> Score: ${newScore} (${newColor})`);

            // 4. Update Client
            const { error: errUpd } = await supabase
                .from('clientes')
                .update({
                    calificacion_score: newScore,
                    calificacion_color: newColor
                })
                .eq('id', client.id);

            if (errUpd) console.error(`Failed to update ${client.nombre}:`, errUpd);
        }

        console.log('✅ Sincronización completa.');

    } catch (e) {
        console.error('Fatal Error:', e);
    }
}

syncScores();
