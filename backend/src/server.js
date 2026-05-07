import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Routes
import userRoutes from './routes/userRoutes.js';
import creditoRoutes from './routes/creditoRoutes.js';
import carteraRoutes from './routes/carteraRoutes.js';
import clienteRoutes from './routes/clienteRoutes.js';
import pagoRoutes from './routes/pagoRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

app.use('/api/users', userRoutes);
app.use('/api/creditos', creditoRoutes);
app.use('/api/carteras', carteraRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/reportes', reportRoutes);

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Sistema de Control de Créditos - API Backend' });
});

// Test Supabase Connection
app.get('/health', async (req, res) => {
    try {
        const { data, error } = await supabase.from('system_config').select('*').limit(1);
        if (error) throw error;
        res.json({ status: 'ok', supabase: 'connected', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
