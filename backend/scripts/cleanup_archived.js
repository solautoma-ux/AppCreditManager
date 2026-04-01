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

async function cleanupArchived() {
    console.log('🧹 Limpiando préstamos archivados (regla de negocio: eliminar sin pagos)...');
    try {
        // Fetch all loans with 'archivado' status
        const { data: archivedLoans, error: errFetch } = await supabase
            .from('creditos')
            .select('id, codigo, estado')
            .eq('estado', 'archivado');

        if (errFetch) throw errFetch;

        console.log(`Encontrados ${archivedLoans.length} préstamos archivados para eliminar.`);

        for (const loan of archivedLoans) {
            // Delete amortizations first
            const { error: errAmort } = await supabase
                .from('amortizaciones')
                .delete()
                .eq('credito_id', loan.id);
            if (errAmort) console.error(`Error deleting amortizations for ${loan.codigo}:`, errAmort);

            // Delete credit
            const { error: errCred } = await supabase
                .from('creditos')
                .delete()
                .eq('id', loan.id);

            if (errCred) console.error(`Error deleting credit ${loan.codigo}:`, errCred);
            else console.log(`✅ Eliminado y purgado: ${loan.codigo}`);
        }

        if (archivedLoans.length === 0) {
            console.log('✨ No hay préstamos archivados. Todo limpio.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

cleanupArchived();
