import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar dotenv para leer .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('🔄 Probando conexión a Supabase...');
    console.log(`📡 URL: ${supabaseUrl}`);

    try {
        const { data, error } = await supabase.from('system_config').select('*').limit(1);

        if (error) {
            throw error;
        }

        console.log('✅ ¡Conexión Exitosa!');
        console.log('📊 Datos de prueba recibidos:', data);
    } catch (err) {
        console.error('❌ Falló la conexión:', err.message);
    }
}

testConnection();
