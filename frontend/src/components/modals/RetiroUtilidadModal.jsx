import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, Box, Alert, CircularProgress,
    InputAdornment
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import { carteraService } from '../../services/carteraService';
import { useToast } from '../../context/ToastContext';

const RetiroUtilidadModal = ({ open, onClose, cartera, onSuccess }) => {
    const { showToast } = useToast();
    const [monto, setMonto] = useState('');
    const [notas, setNotas] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Calculate available profit
    const utilidadDisponible = cartera 
        ? (cartera.saldo_actual + cartera.saldo_prestado) - cartera.monto_inicial
        : 0;

    // Formatter
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    useEffect(() => {
        if (open) {
            setMonto('');
            setNotas('');
            setError(null);
        }
    }, [open]);

    const handleMontoChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setMonto(rawValue);
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const numMonto = parseInt(monto, 10);

        if (!numMonto || isNaN(numMonto) || numMonto <= 0) {
            setError('Por favor, ingresa un monto válido mayor a 0.');
            return;
        }

        if (numMonto > utilidadDisponible) {
            setError(`El monto supera la utilidad disponible (${formatCurrency(utilidadDisponible)}).`);
            return;
        }

        if (numMonto > cartera.saldo_actual) {
            setError(`No hay suficiente saldo físico (efectivo en caja) para realizar este retiro. (Físico: ${formatCurrency(cartera.saldo_actual)}).`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await carteraService.retirarUtilidad(cartera.id, numMonto, notas);
            if (data && data.success) {
                showToast(data.message, 'success');
                onSuccess(); // Triggers a reload of cartera data
                onClose();
            } else {
                throw new Error('Respuesta desconocida del servidor.');
            }
        } catch (err) {
            setError(err.message || 'Ocurrió un error al procesar el retiro.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={!loading ? onClose : null} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
            <form onSubmit={handleSubmit}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
                    <Box sx={{ p: 1, bgcolor: 'secondary.lighter', color: 'secondary.main', borderRadius: 2, display: 'flex' }}>
                        <TrendingUpIcon />
                    </Box>
                    <Typography variant="h6" fontWeight="bold">Retirar Utilidades</Typography>
                </DialogTitle>
                
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Has generado ganancias en esta cartera. Puedes retirar hasta el monto máximo de tu utilidad disponible, siempre y cuando tengas ese efectivo físico en caja.
                    </Typography>

                    <Box sx={{ mb: 3, p: 2, bgcolor: 'background.neutral', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">Utilidad Máxima Disponible:</Typography>
                            <Typography variant="body1" fontWeight="bold" color="secondary.main">
                                {formatCurrency(Math.max(0, utilidadDisponible))}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Efectivo Físico en Caja:</Typography>
                            <Typography variant="body1" fontWeight="bold" color={cartera?.saldo_actual >= utilidadDisponible ? 'text.primary' : 'warning.main'}>
                                {formatCurrency(cartera?.saldo_actual || 0)}
                            </Typography>
                        </Box>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
                            {error}
                        </Alert>
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <TextField
                            label="Monto a Retirar"
                            fullWidth
                            required
                            value={monto ? new Intl.NumberFormat('es-CO').format(monto) : ''}
                            onChange={handleMontoChange}
                            disabled={loading || utilidadDisponible <= 0 || cartera?.saldo_actual <= 0}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                sx: { fontSize: '1.2rem', fontWeight: 'bold' }
                            }}
                        />

                        <TextField
                            label="Notas u Observaciones (Opcional)"
                            fullWidth
                            multiline
                            rows={2}
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            disabled={loading || utilidadDisponible <= 0 || cartera?.saldo_actual <= 0}
                            placeholder="Ej: Retiro de ganancias de Febrero"
                        />
                    </Box>
                </DialogContent>
                
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button onClick={onClose} disabled={loading} color="inherit" sx={{ borderRadius: 2 }}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        disabled={loading || utilidadDisponible <= 0 || cartera?.saldo_actual <= 0 || !monto}
                        sx={{ borderRadius: 2, px: 3 }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirmar Retiro'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default RetiroUtilidadModal;
