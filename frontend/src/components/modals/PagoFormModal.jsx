import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, IconButton, Grid,
    Divider, Chip, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper,
    CircularProgress, LinearProgress, Stack,
    Popover, TextField, InputAdornment, Tooltip,
    Tabs, Tab, useMediaQuery, useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import PaymentIcon from '@mui/icons-material/PaymentRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorIcon from '@mui/icons-material/ErrorOutlineRounded';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthRounded';
import ListAltIcon from '@mui/icons-material/ListAltRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHorizRounded';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import AutorenewIcon from '@mui/icons-material/AutorenewRounded';
import UndoIcon from '@mui/icons-material/UndoRounded';

import { pagoService } from '../../services/pagoService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../common/ConfirmDialog';

const PagoFormModal = ({ open, onClose, credito: creditoData, onSuccess, onRefinance }) => { // creditoData might just be the summary from card
    const theme = useTheme();
    /** Detecta si la pantalla es móvil (xs breakpoint de MUI) */
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [credito, setCredito] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [pagos, setPagos] = useState([]);

    // Popover State for "Otro Valor"
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedCuota, setSelectedCuota] = useState(null);
    const [customPayment, setCustomPayment] = useState({ capital: '', interes: '' });

    // Confirmation Dialog State for "Pagar Cuota"
    const [confirmDialog, setConfirmDialog] = useState({ open: false, cuota: null, loading: false });

    // State for Undoing Payment
    const [undoDialog, setUndoDialog] = useState({ open: false, pago: null, loading: false, confirmText: '' });

    useEffect(() => {
        if (open && creditoData?.id) {
            loadDetalle();
            loadPagos();
        }
    }, [open, creditoData]);

    /**
     * Loads the detailed credit information including amortization schedule.
     */
    const loadDetalle = async () => {
        setLoading(true);
        try {
            const data = await pagoService.getCreditoDetalle(creditoData?.id);
            setCredito(data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Error al cargar el detalle del crédito');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Loads the payment history for the current credit.
     */
    const loadPagos = async () => {
        if (!creditoData?.id) return;
        try {
            const data = await pagoService.getPagosCredito(creditoData.id);
            setPagos(data || []);
        } catch (err) {
            console.error('Error loading pagos:', err);
        }
    };

    // ----- LOGIC FOR PAYMENTS -----

    const handleOpenUndo = (pago) => {
        setUndoDialog({ open: true, pago, loading: false, confirmText: '' });
    };

    const handleConfirmUndo = async () => {
        if (undoDialog.confirmText.toUpperCase() !== 'DESHACER') {
            showToast('Debe escribir DESHACER para confirmar', 'warning');
            return;
        }
        setUndoDialog(prev => ({ ...prev, loading: true }));
        try {
            await pagoService.deshacerPago(undoDialog.pago.id, user.id);
            showToast('Pago reversado exitosamente', 'success');
            await loadDetalle();
            await loadPagos();
            if (onSuccess) onSuccess();
            setUndoDialog({ open: false, pago: null, loading: false, confirmText: '' });
        } catch (err) {
            showToast(err.message || 'Error al deshacer pago', 'error');
            setUndoDialog(prev => ({ ...prev, loading: false }));
        }
    };

    /**
     * Opens confirmation dialog for quota payment.
     * @param {object} cuota - The installment object to pay
     */
    const handlePayQuota = (cuota) => {
        setConfirmDialog({ open: true, cuota, loading: false });
    };

    /**
     * Executes the actual payment after user confirms via dialog.
     */
    const handlePayQuotaConfirmed = async () => {
        const cuota = confirmDialog.cuota;
        if (!cuota) return;
        setConfirmDialog(prev => ({ ...prev, loading: true }));

        // 1. Calculate ideal distribution (Proportional based on total loan)
        let valInteres = 0;
        let valCapital = 0;

        if (credito.monto_total > 0) {
            const ratioInteres = (credito.monto_interes_calculado || 0) / credito.monto_total;
            valInteres = Math.round(cuota.monto_cuota * ratioInteres);
            valCapital = cuota.monto_cuota - valInteres;
        }

        // 2. Adjust based on Pending Balances (Smart Logic)
        if (valInteres > credito.saldo_interes_pendiente) {
            const sobrante = valInteres - credito.saldo_interes_pendiente;
            valInteres = credito.saldo_interes_pendiente;
            valCapital += sobrante;
        }

        // 3. Final Safety Check on Capital
        if (valCapital > credito.saldo_capital_pendiente) {
            const dbl_sobranteCap = valCapital - credito.saldo_capital_pendiente;
            valCapital = credito.saldo_capital_pendiente;
            
            // Si el cliente pagó su capital más rápido (Abono manual previo),
            // el componente de la cuota que iba a capital ahora debe redirigirse 
            // a ir matando los intereses pendientes para mantener el tamaño de cuota que el cajero ve en pantalla.
            valInteres += dbl_sobranteCap;
            
            // Evitamos pasarnos del total de crédito adeudado globalmente
            if (valInteres > credito.saldo_interes_pendiente) {
                valInteres = credito.saldo_interes_pendiente;
            }
        }

        const finalTotal = valInteres + valCapital;

        if (finalTotal <= 0) {
            showToast("El crédito ya está pagado o no hay saldo pendiente.", 'warning');
            setConfirmDialog({ open: false, cuota: null, loading: false });
            return;
        }

        await submitPayment({
            monto_total: finalTotal,
            monto_a_capital: valCapital,
            monto_a_interes: valInteres,
            fecha_pago: new Date().toISOString().split('T')[0],
            notas: 'Pago Cuota'
        });
        setConfirmDialog({ open: false, cuota: null, loading: false });
    };

    /**
     * Opens the popover for entering a custom payment amount.
     * @param {object} event - Click event to anchor the popover
     * @param {object} cuota - The related installment (optional reference)
     */
    const handleOpenCustom = (event, cuota) => {
        setAnchorEl(event.currentTarget);
        setSelectedCuota(cuota);
        setCustomPayment({ capital: '', interes: '' }); // Reset fields
    };

    const handleCloseCustom = () => {
        setAnchorEl(null);
        setSelectedCuota(null);
    };

    /**
     * Submits the custom payment entered in the popover.
     * Validates that the total is greater than 0.
     */
    const handleSubmitCustom = async () => {
        const cap = parseFloat(customPayment.capital) || 0;
        const int = parseFloat(customPayment.interes) || 0;
        const total = cap + int;

        if (total <= 0) {
            showToast("El monto total debe ser mayor a 0", 'warning');
            return;
        }

        // Validación Estricta
        if (int > (credito.saldo_interes_pendiente + 1)) { // +1 margen error decimal mínimo
            showToast(`El abono a interés ($${formatCurrency(int)}) supera el saldo pendiente ($${formatCurrency(credito.saldo_interes_pendiente)})`, 'error');
            return;
        }
        if (cap > (credito.saldo_capital_pendiente + 1)) {
            showToast(`El abono a capital ($${formatCurrency(cap)}) supera el saldo pendiente ($${formatCurrency(credito.saldo_capital_pendiente)})`, 'error');
            return;
        }

        await submitPayment({
            monto_total: total,
            monto_a_capital: cap,
            monto_a_interes: int,
            fecha_pago: new Date().toISOString().split('T')[0],
            notas: 'Abono Manual'
        });
        handleCloseCustom();
    };

    /**
     * Core function to send payment data to the backend.
     * Refreshes data on success.
     * @param {object} payload - Payment data ({monto_total, monto_a_capital, etc.})
     */
    const submitPayment = async (payload) => {
        setSubmitting(true);
        try {
            const result = await pagoService.registrarPago({
                credito_id: credito.id,
                ...payload
            }, user.id);

            if (result.success) {
                // Refresh data
                await loadDetalle();
                await loadPagos(); // Refresh history immediately
                if (onSuccess) onSuccess(); // Notify parent to refresh list
                // Don't close modal so user can see updated status (unless pagado)
                if (result.pagado) {
                    showToast('🎉 ¡Crédito LIQUIDADO completamente!', 'success');
                } else {
                    showToast('Pago registrado exitosamente', 'success');
                }
            }
        } catch (err) {
            console.error(err);
            showToast('Error al registrar pago: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);
    const formatDate = (str) => {
        if (!str) return '';
        // Append T00:00:00 to force local time interpretation
        return new Date(str + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (!open) return null;

    /**
     * Calculates statistics for the credit (Paid, Overdue, Pending quotas).
     */
    const getStats = () => {
        if (!credito?.amortizaciones) return { pagadas: 0, vencidas: 0, pendientes: 0 };
        const hoy = new Date().toISOString().split('T')[0];
        return credito.amortizaciones.reduce((acc, cuota) => {
            if (cuota.estado === 'pagada') acc.pagadas++;
            else if (cuota.fecha_vencimiento < hoy) acc.vencidas++;
            else acc.pendientes++;
            return acc;
        }, { pagadas: 0, vencidas: 0, pendientes: 0 });
    };

    const stats = getStats();
    const saldoPendiente = (credito?.saldo_capital_pendiente || 0) + (credito?.saldo_interes_pendiente || 0);
    const pagado = (credito?.monto_total || 0) - saldoPendiente;
    const progreso = (pagado / (credito?.monto_total || 1)) * 100;

    // Logic to Cap Interest
    const totalInteresPagado = pagos.reduce((acc, p) => acc + (parseFloat(p.monto_a_interes) || 0), 0);
    const interesPactado = credito?.monto_interes_calculado || 0;
    const isInteresCubierto = totalInteresPagado >= interesPactado;

    // Check if within term
    const hoy = new Date().toISOString().split('T')[0];
    const isDentroDePlazo = credito?.fecha_vencimiento >= hoy;

    const bloquearInteres = isInteresCubierto && isDentroDePlazo;

    /**
     * Evalua si un pago individual puede ser deshecho.
     * Un pago es reversable si:
     *   1. Tiene monto positivo (no es un reverso contable).
     *   2. No ha sido previamente reversado (notas no contiene 'REVERSADO' ni '(Reversado)').
     *   3. Es el último pago válido en el historial (regla LIFO).
     *   4. Fue registrado hace menos de 24 horas.
     * @param {object} pago    - El registro de pago a evaluar.
     * @param {Array}  pagos   - Array completo del historial de pagos del crédito.
     * @returns {boolean} true si el pago puede deshacerse.
     */
    const canUndoPago = (pago, pagos) => {
        const bol_esPositivo = parseFloat(pago.monto_total) > 0
            && !pago.notas?.startsWith('REVERSADO')
            && !pago.notas?.includes('(Reversado)');
        const bol_esElUltimo = pagos.find(p =>
            parseFloat(p.monto_total) > 0
            && !p.notas?.startsWith('REVERSADO')
            && !p.notas?.includes('(Reversado)')
        )?.id === pago.id;
        const bol_esReciente = (new Date() - new Date(pago.created_at)) < 24 * 60 * 60 * 1000;
        return bol_esPositivo && bol_esElUltimo && bol_esReciente;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: '12px' } }}
        >
            <DialogTitle sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ lineHeight: 1 }}>Gestionar Pagos</Typography>
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>{credito?.codigo || '...'}</Typography>
                    </Box>

                    {credito && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexGrow: 1, px: 4 }}>
                            <Divider orientation="vertical" flexItem />
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>CLIENTE</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {credito.cliente?.nombre} {credito.cliente?.apellido}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>CÉDULA</Typography>
                                <Typography variant="body2" fontWeight="bold">{credito.cliente?.cedula}</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                                <Chip
                                    label={credito.estado?.toUpperCase()}
                                    size="small"
                                    color={credito.estado === 'activo' ? 'primary' : ['pagado', 'interrumpido', 'refinanciado'].includes(credito.estado) ? 'success' : 'error'}
                                    sx={{ fontWeight: 'bold', height: 20, fontSize: '0.65rem', borderRadius: '4px' }}
                                />
                                <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                    {formatDate(credito.fecha_inicio)}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
                ) : error ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="error">{error}</Typography></Box>
                ) : credito && (
                    <Box>
                        {/* Financial Summary */}
                        <Box sx={{ px: 3, py: 2, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Grid container spacing={2}>
                                <Grid item xs={4}>
                                    <Paper variant="outlined" sx={{ p: 1, borderRadius: '8px', textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Prestado</Typography>
                                        <Typography variant="body2" fontWeight="bold">{formatCurrency(credito.monto_capital)}</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={4}>
                                    <Paper variant="outlined" sx={{ p: 1, borderRadius: '8px', textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Interés</Typography>
                                        <Typography variant="body2" fontWeight="bold" color="warning.main">{formatCurrency(credito.monto_interes_calculado)}</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={4}>
                                    <Paper variant="outlined" sx={{ p: 1, borderRadius: '8px', textAlign: 'center', bgcolor: 'primary.light', borderColor: 'primary.main' }}>
                                        <Typography variant="caption" color="primary.dark" display="block">Deuda Total</Typography>
                                        <Typography variant="body2" fontWeight="bold" color="primary.dark">{formatCurrency(credito.monto_total)}</Typography>
                                    </Paper>
                                </Grid>
                            </Grid>

                            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" fontWeight="bold">Progreso de Pago</Typography>
                                        <Typography variant="caption" fontWeight="bold">{progreso.toFixed(1)}%</Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={progreso} sx={{ height: 6, borderRadius: 3 }} />
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="caption" color="error.main" display="block" fontWeight="bold">Saldo Pendiente</Typography>
                                    <Typography variant="subtitle1" fontWeight="bold" color="error.main" sx={{ lineHeight: 1 }}>{formatCurrency(saldoPendiente)}</Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
                            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                                <Tab label="Plan de Pagos" icon={<CalendarMonthIcon />} iconPosition="start" />
                                <Tab label="Historial de Pagos" icon={<ListAltIcon />} iconPosition="start" />
                            </Tabs>
                        </Box>

                        <Box sx={{ p: 3 }}>
                            {activeTab === 0 ? (
                                /* TAB 0: Plan de Pagos */
                                <>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <PaymentIcon color="action" fontSize="small" /> Próximos Vencimientos
                                        </Typography>

                                        {/* Global Payment Buttons */}
                                        {!['pagado', 'interrumpido', 'refinanciado'].includes(credito.estado) && (
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Tooltip title="Pagar la siguiente cuota pendiente">
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        color="primary"
                                                        onClick={() => {
                                                            const sortedQuotas = [...(credito.amortizaciones || [])].sort((a, b) => a.numero_cuota - b.numero_cuota);
                                                            const firstUnpaid = sortedQuotas.find(c => c.estado !== 'pagada');
                                                            if (firstUnpaid) {
                                                                handlePayQuota(firstUnpaid);
                                                            } else {
                                                                showToast('Todas las cuotas ya están pagadas', 'info');
                                                            }
                                                        }}
                                                        disabled={submitting}
                                                        sx={{ borderRadius: '8px', px: 2 }}
                                                    >
                                                        Pagar Cuota
                                                    </Button>
                                                </Tooltip>
                                                <Tooltip title="Registrar un abono parcial o mayor">
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        color="secondary"
                                                        onClick={(e) => {
                                                            const sortedQuotas = [...(credito.amortizaciones || [])].sort((a, b) => a.numero_cuota - b.numero_cuota);
                                                            const firstUnpaid = sortedQuotas.find(c => c.estado !== 'pagada');
                                                            handleOpenCustom(e, firstUnpaid || sortedQuotas[0]);
                                                        }}
                                                        disabled={submitting}
                                                        sx={{ borderRadius: '8px', px: 2 }}
                                                    >
                                                        Otro Valor
                                                    </Button>
                                                </Tooltip>
                                                <Tooltip title="Refinanciar el crédito actual">
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        color="info"
                                                        onClick={() => {
                                                            onClose();
                                                            if (onRefinance) onRefinance(credito);
                                                        }}
                                                        startIcon={<AutorenewIcon />}
                                                        disabled={submitting}
                                                        sx={{ borderRadius: '8px', px: 2 }}
                                                    >
                                                        Refinanciar
                                                    </Button>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </Box>

                                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>#</TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>Vencimiento</TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper', pl: 4 }}>Valor Cuota</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'background.paper', width: 80 }}>Estado</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {credito.amortizaciones
                                                    ?.sort((a, b) => a.numero_cuota - b.numero_cuota)
                                                    .map((cuota, index) => {
                                                        // 1. Its actual database state is 'pagada'
                                                        // 2. The entire loan is fully liquidated/closed
                                                        const isPaidVisually = cuota.estado === 'pagada' || ['pagado', 'interrumpido', 'refinanciado'].includes(credito.estado);

                                                        return (
                                                            <TableRow key={cuota.id} sx={{ bgcolor: isPaidVisually ? 'action.hover' : 'inherit' }}>
                                                                <TableCell>{cuota.numero_cuota}</TableCell>
                                                                <TableCell>{formatDate(cuota.fecha_vencimiento)}</TableCell>
                                                                <TableCell sx={{ fontWeight: 'bold', pl: 4 }}>{formatCurrency(cuota.monto_cuota)}</TableCell>
                                                                <TableCell align="center">
                                                                    {isPaidVisually && (
                                                                        <CheckCircleIcon color="success" fontSize="small" />
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </>
                            ) : (
                                /* TAB 1: Historial */
                                <>
                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ListAltIcon color="action" fontSize="small" /> Historial de Transacciones
                                    </Typography>

                                    {pagos.length === 0 ? (
                                        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                            <Typography>No hay pagos registrados aún.</Typography>
                                        </Box>
                                    ) : isMobile ? (
                                        /* ── VISTA MÓVIL: cada pago se muestra como una card ── */
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                            {pagos.map((pago) => {
                                                /** Reglas para habilitar el botón de deshacer pago */
                                                const canUndo = canUndoPago(pago, pagos);
                                                /** Color de fondo: rojo suave para reversiones, blanco para pagos normales */
                                                const str_bgColor = pago.monto_total < 0 ? 'error.lighter' : 'background.paper';
                                                /** Color del texto para montos negativos (reversión) */
                                                const str_colorMonto = pago.monto_total < 0 ? 'error.main' : 'text.primary';

                                                return (
                                                    /* Card individual por cada pago */
                                                    <Paper
                                                        key={pago.id}
                                                        variant="outlined"
                                                        sx={{
                                                            p: 1.5,
                                                            borderRadius: '10px',
                                                            bgcolor: str_bgColor,
                                                            borderColor: pago.monto_total < 0 ? 'error.light' : 'divider'
                                                        }}
                                                    >
                                                        {/* Fila superior: fecha + registrado por + botón deshacer */}
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary">Fecha</Typography>
                                                                <Typography variant="body2" fontWeight="bold">{formatDate(pago.fecha_pago)}</Typography>
                                                            </Box>
                                                            <Box sx={{ textAlign: 'center' }}>
                                                                <Typography variant="caption" color="text.secondary">Registrado Por</Typography>
                                                                <Typography variant="body2" color="text.secondary">{pago.registrado_por?.nombre || '...'}</Typography>
                                                            </Box>
                                                            {/* Botón deshacer: sólo visible si aplica */}
                                                            {canUndo ? (
                                                                <Tooltip title="Deshacer pago (Solo el último pago y < 24h)">
                                                                    <IconButton size="small" color="error" onClick={() => handleOpenUndo(pago)}>
                                                                        <UndoIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : (
                                                                /* Espacio reservado para mantener alineación */
                                                                <Box sx={{ width: 32 }} />
                                                            )}
                                                        </Box>

                                                        {/* Divider separador */}
                                                        <Divider sx={{ my: 0.75 }} />

                                                        {/* Fila inferior: montos en 3 columnas */}
                                                        <Grid container spacing={1}>
                                                            {/* Monto total del pago */}
                                                            <Grid item xs={4}>
                                                                <Typography variant="caption" color="text.secondary" display="block">Monto Total</Typography>
                                                                <Typography variant="body2" fontWeight="bold" color={str_colorMonto}>
                                                                    {formatCurrency(pago.monto_total)}
                                                                </Typography>
                                                            </Grid>
                                                            {/* Monto abonado a capital */}
                                                            <Grid item xs={4}>
                                                                <Typography variant="caption" color="text.secondary" display="block">A Capital</Typography>
                                                                <Typography variant="body2" fontWeight="bold" color={pago.monto_total < 0 ? 'error.main' : 'success.main'}>
                                                                    {formatCurrency(pago.monto_a_capital)}
                                                                </Typography>
                                                            </Grid>
                                                            {/* Monto abonado a interés */}
                                                            <Grid item xs={4}>
                                                                <Typography variant="caption" color="text.secondary" display="block">A Interés</Typography>
                                                                <Typography variant="body2" fontWeight="bold" color={pago.monto_total < 0 ? 'error.main' : 'warning.main'}>
                                                                    {formatCurrency(pago.monto_a_interes)}
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>

                                                        {/* Notas (si existen) */}
                                                        {pago.notas && (
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontStyle: 'italic' }}>
                                                                {pago.notas}
                                                            </Typography>
                                                        )}
                                                    </Paper>
                                                );
                                            })}

                                            {/* Totales al pie en vista móvil */}
                                            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'action.hover' }}>
                                                <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>TOTALES PAGADOS</Typography>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary">A Capital</Typography>
                                                        <Typography variant="body2" fontWeight="bold" color="success.dark">
                                                            {formatCurrency(pagos.reduce((acc, p) => acc + (parseFloat(p.monto_a_capital) || 0), 0))}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ textAlign: 'right' }}>
                                                        <Typography variant="caption" color="text.secondary">A Interés</Typography>
                                                        <Typography variant="body2" fontWeight="bold" color="warning.dark">
                                                            {formatCurrency(pagos.reduce((acc, p) => acc + (parseFloat(p.monto_a_interes) || 0), 0))}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Paper>
                                        </Box>
                                    ) : (
                                        /* ── VISTA DESKTOP: tabla completa ── */
                                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
                                            <Table stickyHeader size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>Registrado Por</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Monto Total</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>A Capital</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>A Interés</TableCell>
                                                        <TableCell>Notas</TableCell>
                                                        <TableCell align="center">Acciones</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {pagos.map((pago) => {
                                                        /** Reglas para habilitar el botón de deshacer pago */
                                                        const canUndo = canUndoPago(pago, pagos);

                                                        return (
                                                            <TableRow key={pago.id} sx={{ bgcolor: pago.monto_total < 0 ? 'error.lighter' : 'inherit' }}>
                                                                <TableCell>{formatDate(pago.fecha_pago)}</TableCell>
                                                                <TableCell variant="body2" sx={{ color: 'text.secondary' }}>
                                                                    {pago.registrado_por?.nombre || ' ...'}
                                                                </TableCell>
                                                                <TableCell align="right" sx={{ color: pago.monto_total < 0 ? 'error.main' : 'inherit' }}>{formatCurrency(pago.monto_total)}</TableCell>
                                                                <TableCell align="right" sx={{ color: pago.monto_total < 0 ? 'error.main' : 'inherit' }}>{formatCurrency(pago.monto_a_capital)}</TableCell>
                                                                <TableCell align="right" sx={{ color: pago.monto_total < 0 ? 'error.main' : 'inherit' }}>{formatCurrency(pago.monto_a_interes)}</TableCell>
                                                                <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    <Tooltip title={pago.notas || ''}>
                                                                        <span>{pago.notas || '-'}</span>
                                                                    </Tooltip>
                                                                </TableCell>
                                                                <TableCell align="center">
                                                                    {canUndo && (
                                                                        <Tooltip title="Deshacer pago (Solo el último pago y < 24h)">
                                                                            <IconButton size="small" color="error" onClick={() => handleOpenUndo(pago)}>
                                                                                <UndoIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                                {/* Footer con totales en desktop */}
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>TOTALES PAGADOS:</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.dark', fontSize: '0.9rem' }}>
                                                            {formatCurrency(pagos.reduce((acc, p) => acc + (parseFloat(p.monto_a_capital) || 0), 0))}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.dark', fontSize: '0.9rem' }}>
                                                            {formatCurrency(pagos.reduce((acc, p) => acc + (parseFloat(p.monto_a_interes) || 0), 0))}
                                                        </TableCell>
                                                        <TableCell />
                                                    </TableRow>
                                                </TableHead>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </>
                            )}
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} color="inherit" sx={{ borderRadius: '8px' }}>Cerrar</Button>
            </DialogActions>

            {/* Custom Payment Popover */}
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={handleCloseCustom}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                PaperProps={{ sx: { p: 2, width: 300, borderRadius: '12px' } }}
            >
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    Pago Manual - Cuota #{selectedCuota?.numero_cuota}
                </Typography>

                {bloquearInteres && (
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
                        <Typography variant="caption" color="success.dark" fontWeight="bold">
                            🎉 ¡Interés Completado!
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                            Ya se cubrió el 100% del interés pactado en el plazo. Todo abono irá a Capital.
                        </Typography>
                    </Box>
                )}

                <Typography variant="caption" color="text.secondary" paragraph>
                    Distribuye el monto manualmente.
                </Typography>

                <Grid container spacing={2}>
                    <Grid item xs={bloquearInteres ? 12 : 6}>
                        <TextField
                            label="A Capital"
                            size="small"
                            type="number"
                            fullWidth
                            value={customPayment.capital}
                            onChange={(e) => setCustomPayment({ ...customPayment, capital: e.target.value })}
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        />
                    </Grid>
                    {!bloquearInteres && (
                        <Grid item xs={6}>
                            <TextField
                                label="A Interés"
                                size="small"
                                type="number"
                                fullWidth
                                value={customPayment.interes}
                                onChange={(e) => setCustomPayment({ ...customPayment, interes: e.target.value })}
                                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            />
                        </Grid>
                    )}
                    <Grid item xs={12}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                            <Typography variant="caption" fontWeight="bold">Total a Pagar:</Typography>
                            <Typography variant="subtitle2" fontWeight="bold">
                                {formatCurrency((parseFloat(customPayment.capital) || 0) + (parseFloat(customPayment.interes) || 0))}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12}>
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleSubmitCustom}
                            disabled={submitting}
                            sx={{ borderRadius: '8px' }}
                        >
                            Confirmar Pago
                        </Button>
                    </Grid>
                </Grid>
            </Popover>

            {/* Confirm Payment Dialog */}
            <ConfirmDialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog({ open: false, cuota: null, loading: false })}
                onConfirm={handlePayQuotaConfirmed}
                title="Confirmar Pago de Cuota"
                message={`¿Confirmas el pago de la cuota #${confirmDialog.cuota?.numero_cuota} por ${formatCurrency(confirmDialog.cuota?.monto_cuota)}?`}
                confirmText="Pagar"
                confirmColor="primary"
                loading={confirmDialog.loading}
            />

            {/* Undo Payment Confirmation Dialog */}
            <Dialog open={undoDialog.open} onClose={() => setUndoDialog({ open: false, pago: null, loading: false, confirmText: '' })} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <UndoIcon /> Confirmar Reverso de Pago
                </DialogTitle>
                <DialogContent dividers>
                    <Typography gutterBottom>
                        Estás a punto de deshacer el último pago registrado por valor de <strong>{formatCurrency(undoDialog.pago?.monto_total)}</strong>.
                    </Typography>
                    <Typography color="text.secondary" variant="body2" paragraph>
                        Esto devolverá el saldo al crédito, descontará el dinero de la cartera y restaurará las cuotas afectadas. Esta acción quedará registrada en el log de auditoría.
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Para confirmar, escribe la palabra DESHACER:
                    </Typography>
                    <TextField 
                        fullWidth 
                        size="small"
                        placeholder="DESHACER" 
                        value={undoDialog.confirmText}
                        onChange={(e) => setUndoDialog(prev => ({ ...prev, confirmText: e.target.value }))}
                        error={undoDialog.confirmText.length > 0 && undoDialog.confirmText.toUpperCase() !== 'DESHACER'}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setUndoDialog({ open: false, pago: null, loading: false, confirmText: '' })} color="inherit">
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleConfirmUndo} 
                        color="error" 
                        variant="contained" 
                        disabled={undoDialog.loading || undoDialog.confirmText.toUpperCase() !== 'DESHACER'}
                    >
                        {undoDialog.loading ? <CircularProgress size={24} color="inherit" /> : 'Confirmar Reverso'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
};

export default PagoFormModal;
