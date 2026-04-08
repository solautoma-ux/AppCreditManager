import React, { useState } from 'react';
import {
    Box, Typography, Paper, Button, Divider, Alert,
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import { CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';
import { userService } from '../services/userService';


const Configuracion = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [dbSize, setDbSize] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // Fetch DB Size
    const fetchDbSize = async () => {
        setLoadingStats(true);
        try {
            const { data, error } = await supabase.rpc('get_database_size');
            if (error) throw error;
            setDbSize(data);
        } catch (err) {
            console.error('Error fetching DB size:', err);
            showToast('Error al obtener tamaño de BD', 'error');
        } finally {
            setLoadingStats(false);
        }
    };

    const [loadingPrune, setLoadingPrune] = useState(false);
    const [pruneResult, setPruneResult] = useState('');

    const handlePruneLogs = async (days) => {
        if (!window.confirm(`¿Estás seguro de eliminar los logs anteriores a ${days} días? Esta acción no se puede deshacer.`)) return;

        setLoadingPrune(true);
        setPruneResult('');
        try {
            const { data, error } = await supabase.rpc('prune_audit_logs', { p_days_to_keep: days });
            if (error) throw error;

            if (data.success) {
                setPruneResult(data.message);
                showToast('Logs depurados exitosamente', 'success');
                fetchDbSize(); // Actualizar tamaño de BD
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Error pruning logs:', err);
            showToast('Error al depurar logs', 'error');
        } finally {
            setLoadingPrune(false);
        }
    };

    // Initial load
    React.useEffect(() => {
        if (user?.rol === 'super_admin') {
            fetchDbSize();
        }
    }, [user]);

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    // Only Super Admin
    if (user?.rol !== 'super_admin') {
        return <Alert severity="error">Acceso denegado. Solo Super Admin puede ver esta sección.</Alert>;
    }

    /**
     * Ejecuta el reset completo del sistema via el backend.
     * El backend: (1) limpia las tablas de BD, (2) borra admins/encargados de public.usuarios,
     * (3) borra a todos los usuarios de auth.users excepto el Super Admin.
     */
    const handleReset = async () => {
        if (confirmText !== 'ELIMINAR TODO') return;

        setLoading(true);
        try {
            // Llamar al backend (service_role) que también limpia auth.users
            const result = await userService.resetCompleto();

            showToast(result.message || 'Sistema reseteado exitosamente', 'success');
            setModalOpen(false);
            setConfirmText('');
            // Recargar para limpiar estados del frontend
            window.location.reload();
        } catch (err) {
            console.error('[RESET] Error:', err);
            showToast('Error al resetear: ' + (err.message || err), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box maxWidth="md" sx={{ mx: 'auto', mt: 4 }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                Configuración
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
                Opciones avanzadas del sistema.
            </Typography>

            {/* MONITOR DE BASE DE DATOS */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', mb: 4, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        💾 Uso de Almacenamiento
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={fetchDbSize}
                        disabled={loadingStats}
                        startIcon={loadingStats ? <CircularProgress size={16} /> : <RefreshIcon />}
                        sx={{ borderRadius: 2 }}
                    >
                        {loadingStats ? 'Calculando...' : 'Actualizar'}
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="h3" fontWeight="bold" color="primary.main">
                        {formatBytes(dbSize)}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        ocupados en base de datos
                    </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Incluye todas las tablas, índices y datos del sistema. (Plan Gratuito: Máx 500MB)
                </Typography>
            </Paper>

            {/* OPTIMIZACIÓN DE LOGS */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', mb: 4, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    🛡️ Auditoría y Logs
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Mantén la tabla de auditoría ligera eliminando registros antiguos.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => handlePruneLogs(30)}
                        disabled={loadingPrune}
                    >
                        Conservar solo 30 días
                    </Button>
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => handlePruneLogs(60)}
                        disabled={loadingPrune}
                    >
                        Conservar solo 60 días
                    </Button>
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => handlePruneLogs(90)}
                        disabled={loadingPrune}
                    >
                        Conservar solo 90 días
                    </Button>
                </Box>
                {pruneResult && (
                    <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
                        {pruneResult}
                    </Alert>
                )}
            </Paper>

            <Alert severity="warning" icon={<WarningAmberRoundedIcon />} sx={{ mb: 4, borderRadius: '12px' }}>
                Estas acciones son irreversibles. Proceda con precaución.
            </Alert>

            {/* ZONA DE PELIGRO */}
            <Paper
                elevation={0}
                sx={{
                    p: 4,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: 'error.main',
                    bgcolor: 'error.lighter'
                }}
            >
                <Typography variant="h6" fontWeight="bold" color="error.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteForeverRoundedIcon />
                    Zona de Peligro
                </Typography>
                <Divider sx={{ my: 2, borderColor: 'error.light' }} />

                <Box>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Resetear Sistema Completo
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Esta acción eliminará <strong>permanentemente</strong> toda la información transaccional del sistema:
                    </Typography>
                    <ul>
                        <li><Typography variant="body2" color="text.secondary">Todas las Carteras y sus Saldos</Typography></li>
                        <li><Typography variant="body2" color="text.secondary">Todos los Clientes y sus Datos</Typography></li>
                        <li><Typography variant="body2" color="text.secondary">Todos los Préstamos, Amortizaciones y Pagos</Typography></li>
                        <li><Typography variant="body2" color="text.secondary">Relaciones de Encargados</Typography></li>
                    </ul>
                    <Typography variant="body2" fontWeight="bold" paragraph>
                        ⚠️ Esta acción eliminará también los accesos de todos los admins y encargados.
                        Solo el Super Admin será preservado.
                    </Typography>

                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<DeleteForeverRoundedIcon />}
                        onClick={() => setModalOpen(true)}
                        sx={{ mt: 2, borderRadius: 3, boxShadow: 'none' }}
                    >
                        Resetear Sistema
                    </Button>
                </Box>
            </Paper>

            {/* Modal de Confirmación */}
            <Dialog
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
            >
                <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold', display: 'flex', gap: 1, alignItems: 'center' }}>
                    <WarningAmberRoundedIcon /> Confirmación Crítica
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" paragraph>
                        ¿Estás absolutamente seguro? Esta acción <strong>NO</strong> se puede deshacer.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Escribe <strong>ELIMINAR TODO</strong> en el campo de abajo para confirmar.
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="ELIMINAR TODO"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        error={confirmText.length > 0 && confirmText !== 'ELIMINAR TODO'}
                        InputProps={{ sx: { borderRadius: 3 } }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setModalOpen(false)} sx={{ borderRadius: 3 }}>Cancelar</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleReset}
                        disabled={confirmText !== 'ELIMINAR TODO' || loading}
                        sx={{ borderRadius: 3, px: 3 }}
                    >
                        {loading ? 'Eliminando...' : 'Confirmar Reset'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Configuracion;
