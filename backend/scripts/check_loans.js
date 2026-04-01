
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLoanStatus() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Hoy es: ${today}\n`);

    const { data: creditos, error } = await supabase
        .from('creditos')
        .select(`
            id, 
            codigo, 
            estado, 
            fecha_vencimiento, 
            saldo_capital_pendiente, 
            saldo_interes_pendiente,
            cliente:clientes(nombre, apellido)
        `);

    if (error) {
        console.error('Error fetching credits:', error);
        return;
    }

    console.log('📋 Estado de Préstamos:');
    creditos.forEach(c => {
        const isPastDue = new Date(c.fecha_vencimiento) < new Date(today);
        console.log(`- [${c.codigo}] ${c.cliente.nombre}: ${c.estado} | Vence: ${c.fecha_vencimiento} | Saldo: ${c.saldo_capital_pendiente + c.saldo_interes_pendiente} | ¿Pasado? ${isPastDue ? 'SÍ' : 'NO'}`);
    });
}

checkLoanStatus();
