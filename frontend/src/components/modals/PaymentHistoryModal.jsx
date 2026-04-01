import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Chip,
    IconButton,
    Divider,
    Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { supabase } from '../../services/supabaseClient';

/**
 * Modal que muestra el historial de pagos de suscripción de un administrador.
 * Consulta directamente la tabla `subscription_payments` vía Supabase.
 * Se abre desde la card del suscriptor en la vista de Gestión de Suscripciones.
 *
 * @param {boolean} open - Estado de visibilidad del modal
 * @param {function} onClose - Función para cerrar el modal
 * @param {object} admin - Objeto completo del administrador (con .suscripcion)
 */
const PaymentHistoryModal = ({ open, onClose, admin }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch del historial de pagos al abrir el modal
    useEffect(() => {
        if (open && admin?.id) {
            fetchHistory();
        }
    }, [open, admin]);

    /**
     * Consulta directa a Supabase para obtener los pagos de suscripción.
     * Usa la relación admin_subscriptions -> subscription_payments.
     */
    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            // Primero obtener el ID de suscripción del admin
            const { data: subData, error: subError } = await supabase
                .from('admin_subscriptions')
                .select('id')
                .eq('admin_id', admin.id)
                .single();

            if (subError && subError.code !== 'PGRST116') throw subError;

            // Si no tiene suscripción, mostrar vacío
            if (!subData) {
                setHistory([]);
                setLoading(false);
                return;
            }

            // Obtener los pagos de esa suscripción
            const { data: payments, error: paymentsError } = await supabase
                .from('subscription_payments')
                .select('*')
                .eq('subscription_id', subData.id)
                .order('fecha_pago', { ascending: false });

            if (paymentsError) throw paymentsError;

            setHistory(payments || []);
        } catch (err) {
            console.error('Error fetching subscription history:', err);
            setError('No se pudo cargar el historial. Verifica que la tabla subscription_payments exista.');
        } finally {
            setLoading(false);
        }
    };

    // Formateador de moneda colombiana
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);

    // Formateador de fecha legible
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        // Parsear manualmente para evitar problemas de timezone
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '8px' } }}>
            {/* Header del modal */}
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                <Box>
                    <Typography variant="h6" fontWeight="bold">📋 Historial de Pagos</Typography>
                    {admin && (
                        <Typography variant="body2" color="text.secondary">
                            Suscripción de {admin.nombre} {admin.apellido}
                        </Typography>
                    )}
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'action.hover' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />

            {/* Contenido del modal */}
            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Box sx={{ p: 3 }}>
                        <Alert severity="warning" sx={{ borderRadius: '8px' }}>{error}</Alert>
                    </Box>
                ) : history.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">No hay pagos registrados aún.</Typography>
                    </Box>
                ) : (
                    <TableContainer sx={{ maxHeight: 400 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Fecha Pago</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Mes Pagado</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Monto</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Método</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Notas</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.map((pago) => (
                                    <TableRow key={pago.id} hover>
                                        <TableCell>{formatDate(pago.fecha_pago)}</TableCell>
                                        <TableCell>
                                            <Chip label={pago.mes_pagado || '-'} size="small" variant="outlined" sx={{ borderRadius: '6px' }} />
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                            {formatCurrency(pago.monto_pagado)}
                                        </TableCell>
                                        <TableCell>{pago.metodo_pago || '-'}</TableCell>
                                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                                            {pago.notas || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DialogContent>

            {/* Footer */}
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} variant="outlined" sx={{ borderRadius: '8px' }}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default PaymentHistoryModal;
