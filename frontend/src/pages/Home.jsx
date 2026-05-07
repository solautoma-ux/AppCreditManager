import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Tab, Tabs,
    IconButton, Tooltip, Chip, CircularProgress, Alert,
    Fab, useTheme, Grid, Button, LinearProgress
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    SavingsRounded as SavingsIcon, // Icono alcancía
    WhatsApp as WhatsAppIcon,
    Payment as PaymentIcon,
    Today as TodayIcon,
    Warning as WarningIcon,
    ErrorRounded as ErrorIcon,
    DeleteOutlineRounded as DeleteIcon,
    CheckCircleOutlineRounded as CheckCircleIcon,
    AutorenewRounded as AutorenewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { homeService } from '../services/homeService';
import PagoFormModal from '../components/modals/PagoFormModal';
import CreditoFormModal from '../components/modals/CreditoFormModal';
import BuscadorPagoModal from '../components/modals/BuscadorPagoModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import CreditoCardBase from '../components/common/CreditoCardBase';
import { creditoService } from '../services/creditoService';
import { calculateDaysOverdue } from '../utils/mathUtils';
import { useCreditoActions } from '../hooks/useCreditoActions';

const Home = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const theme = useTheme();

    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [todayPayments, setTodayPayments] = useState([]);
    const [overduePayments, setOverduePayments] = useState([]);
    const [todayPaymentsGrouped, setTodayPaymentsGrouped] = useState([]);
    const [overduePaymentsGrouped, setOverduePaymentsGrouped] = useState([]);
    const [vencidoPayments, setVencidoPayments] = useState([]);
    const [vencidoPaymentsGrouped, setVencidoPaymentsGrouped] = useState([]);
    const [error, setError] = useState(null);
    const [debugDate, setDebugDate] = useState('');

    // Modal states
    const [pagoModalOpen, setPagoModalOpen] = useState(false);
    const [buscadorModalOpen, setBuscadorModalOpen] = useState(false);
    const [creditoModalOpen, setCreditoModalOpen] = useState(false);
    const [selectedCredito, setSelectedCredito] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get the same date calculation as the service for display
            const now = new Date();
            const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
                .toISOString().split('T')[0];
            setDebugDate(localDate);

            const [today, overdue, vencidos] = await Promise.all([
                homeService.getTodayPayments(user.id, user.rol),
                homeService.getOverduePayments(user.id, user.rol),
                homeService.getVencidoInstallments(user.id, user.rol)
            ]);

            setTodayPaymentsGrouped(groupAndSortPayments(today));
            setOverduePaymentsGrouped(groupAndSortPayments(overdue));
            setVencidoPaymentsGrouped(groupAndSortPayments(vencidos));

            // Still keep raw totals for the tabs
            setTodayPayments(today);
            setOverduePayments(overdue);
            setVencidoPayments(vencidos);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error desconocido al cargar datos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const {
        obj_deleteDialog,
        obj_liquidateDialog,
        handleDeleteClick,
        handleDeleteConfirm,
        closeDeleteDialog,
        handleLiquidateClick,
        handleLiquidateConfirm,
        closeLiquidateDialog
    } = useCreditoActions(fetchData);

    const groupAndSortPayments = (payments) => {
        if (!payments || payments.length === 0) return [];

        const groups = {};
        payments.forEach(item => {
            const clienteId = item.credito?.cliente?.id;
            if (!clienteId) return;

            if (!groups[clienteId]) {
                groups[clienteId] = {
                    cliente: item.credito.cliente,
                    cartera: item.credito.cartera,
                    payments: [],
                    oldestDate: item.fecha_vencimiento
                };
            }

            groups[clienteId].payments.push(item);
            if (item.fecha_vencimiento < groups[clienteId].oldestDate) {
                groups[clienteId].oldestDate = item.fecha_vencimiento;
            }
        });

        // Convert to array and sort groups by oldest date
        const sortedGroups = Object.values(groups).sort((a, b) => a.oldestDate.localeCompare(b.oldestDate));

        // Sort payments within each group
        sortedGroups.forEach(group => {
            group.payments.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
        });

        return sortedGroups;
    };

    // fetchData and useEffect were hoisted to avoid ReferenceError

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const handlePay = (amortizacion) => {
        if (!amortizacion?.credito) {
            showToast('No hay información de crédito para este pago', 'error');
            return;
        }
        setSelectedCredito(amortizacion.credito);
        setPagoModalOpen(true);
    };

    const handlePaymentSuccess = () => {
        fetchData(); // Reload data
    };

    const handleNotify = (amortizacion) => {
        const cliente = amortizacion.credito?.cliente;
        if (!cliente?.movil) {
            showToast('El cliente no tiene celular registrado', 'warning');
            return;
        }

        // Build base message with payment details
        const mensaje = `Hola ${cliente.nombre}, le recordamos el pago de su cuota por valor de ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amortizacion.monto_cuota)} que vence el ${amortizacion.fecha_vencimiento}.`;

        // Get custom suffix from user config (stored in user context)
        const customSuffix = user?.whatsapp_mensaje_custom || '';

        // Use centralized service with optional custom suffix
        import('../services/whatsappService').then(({ whatsappService }) => {
            whatsappService.sendTo(cliente.movil, mensaje, customSuffix);
        });
    };

    const handleRefinance = (credito) => {
        setSelectedCredito(credito);
        setCreditoModalOpen(true);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    // El componente PaymentCard ha sido delegado a CreditoCardBase para cumplir el Principio DRY

    return (
        <Box sx={{ pb: 10 }}> {/* Padding bottom for FAB space */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">Gestión de hoy</Typography>
                <Typography variant="body1" color="text.secondary">Hola, {user?.nombre || user?.email}</Typography>
            </Box>

            <Paper sx={{ borderRadius: '16px', mb: 3 }}>
                <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" indicatorColor="primary" textColor="primary">
                    <Tab icon={<TodayIcon />} label={`HOY (${todayPayments.length})`} iconPosition="start" />
                    <Tab icon={<WarningIcon />} label={`PENDIENTES (${overduePayments.length})`} iconPosition="start" />
                    <Tab icon={<ErrorIcon />} label={`VENCIDOS (${vencidoPayments.length})`} iconPosition="start" sx={{ color: 'error.main' }} />
                </Tabs>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : error ? (
                <Alert severity="error">
                    {error instanceof Object ? JSON.stringify(error) : error}
                </Alert>
            ) : (
                <Box>
                    {tabValue === 0 && (
                        <Box>
                            {/* Summary for Today (Compact) */}
                            {todayPayments.length > 0 && (
                                <Paper sx={{ p: 2, mb: 2, borderRadius: '16px', backgroundImage: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
                                            Meta de recaudo hoy
                                        </Typography>
                                        <Typography variant="h5" fontWeight="bold">
                                            {formatCurrency(todayPayments.reduce((acc, p) => acc + p.monto_cuota, 0))}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end', opacity: 0.9 }}>
                                            <MoneyIcon fontSize="small" />
                                            <Typography variant="subtitle2" fontWeight="bold">
                                                {todayPayments.length}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                            pagos esperados
                                        </Typography>
                                    </Box>
                                </Paper>
                            )}

                            {todayPayments.length === 0 ? (
                                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4, bgcolor: 'background.paper' }}>
                                    <Typography variant="h6" color="text.secondary">🎉 ¡Todo al día!</Typography>
                                    <Typography variant="body2" color="text.secondary">No hay pagos a recibir el día de hoy.</Typography>
                                </Paper>
                            ) : (
                                <Grid container spacing={2}>
                                    {todayPayments.map(item => (
                                        <Grid item xs={12} md={6} key={item.id}>
                                            <CreditoCardBase
                                                obj_credito={item.credito}
                                                obj_paymentItem={item}
                                                bol_isOverdue={false}
                                                onPay={handlePay}
                                                onNotify={handleNotify}
                                                onRefinance={handleRefinance}
                                                onLiquidate={handleLiquidateClick}
                                                onDelete={handleDeleteClick}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </Box>
                    )}

                    {tabValue === 1 && (
                        <Box>
                            {/* Summary for Overdue (Compact) */}
                            {overduePayments.length > 0 && (
                                <Paper sx={{ p: 2, mb: 2, borderRadius: '16px', backgroundImage: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
                                            Pendientes (Atrasados)
                                        </Typography>
                                        <Typography variant="h5" fontWeight="bold">
                                            {formatCurrency(overduePayments.reduce((acc, p) => acc + p.monto_cuota, 0))}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end', opacity: 0.9 }}>
                                            <WarningIcon fontSize="small" />
                                            <Typography variant="subtitle2" fontWeight="bold">
                                                {overduePayments.length}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                            cuotas pendientes
                                        </Typography>
                                    </Box>
                                </Paper>
                            )}

                            {overduePayments.length === 0 ? (
                                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4, bgcolor: 'background.paper' }}>
                                    <Typography variant="h6" color="text.secondary">✨ ¡Excelente!</Typography>
                                    <Typography variant="body2" color="text.secondary">No hay pagos pendientes de días anteriores.</Typography>
                                </Paper>
                            ) : (
                                <Grid container spacing={2}>
                                    {overduePayments.map(item => (
                                        <Grid item xs={12} md={6} key={item.id}>
                                            <CreditoCardBase
                                                obj_credito={item.credito}
                                                obj_paymentItem={item}
                                                bol_isOverdue={true}
                                                int_overdueDays={calculateDaysOverdue(item.fecha_vencimiento)}
                                                onPay={handlePay}
                                                onNotify={handleNotify}
                                                onRefinance={handleRefinance}
                                                onLiquidate={handleLiquidateClick}
                                                onDelete={handleDeleteClick}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </Box>
                    )}

                    {tabValue === 2 && (
                        <Box>
                            {/* Summary for Vencidos */}
                            {vencidoPayments.length > 0 && (
                                <Paper sx={{ p: 2, mb: 2, borderRadius: '16px', backgroundImage: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
                                            Cartera Castigada (Vencida)
                                        </Typography>
                                        <Typography variant="h5" fontWeight="bold">
                                            {formatCurrency(vencidoPayments.reduce((acc, p) => acc + p.monto_cuota, 0))}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end', opacity: 0.9 }}>
                                            <ErrorIcon fontSize="small" />
                                            <Typography variant="subtitle2" fontWeight="bold">
                                                {vencidoPayments.length}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                            cuotas en cobro jurídico
                                        </Typography>
                                    </Box>
                                </Paper>
                            )}

                            {vencidoPayments.length === 0 ? (
                                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4, bgcolor: 'background.paper' }}>
                                    <Typography variant="h6" color="text.secondary">✅ Sin Cartera Vencida</Typography>
                                    <Typography variant="body2" color="text.secondary">No tienes créditos en estado 'Vencido'.</Typography>
                                </Paper>
                            ) : (
                                <Grid container spacing={2}>
                                    {vencidoPayments.map(item => (
                                        <Grid item xs={12} md={6} key={item.id}>
                                            <CreditoCardBase
                                                obj_credito={item.credito}
                                                obj_paymentItem={item}
                                                bol_isOverdue={true}
                                                int_overdueDays={calculateDaysOverdue(item.fecha_vencimiento)}
                                                onPay={handlePay}
                                                onNotify={handleNotify}
                                                onRefinance={handleRefinance}
                                                onLiquidate={handleLiquidateClick}
                                                onDelete={handleDeleteClick}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </Box>
                    )}
                </Box>
            )}


            {/* Floating Action Buttons */}
            <Box sx={{ position: 'fixed', bottom: 32, right: 32, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', zIndex: 1000 }}>
                <Tooltip title="Crear Préstamo" placement="left">
                    <Fab
                        color="secondary"
                        aria-label="add-loan"
                        onClick={() => setCreditoModalOpen(true)}
                    >
                        <SavingsIcon />
                    </Fab>
                </Tooltip>
                <Tooltip title="Registrar Pago Global (Buscar)" placement="left">
                    <Fab
                        color="primary"
                        aria-label="add-payment"
                        onClick={() => setBuscadorModalOpen(true)}
                    >
                        <MoneyIcon />
                    </Fab>
                </Tooltip>
            </Box>

            {/* Modals */}
            <BuscadorPagoModal
                open={buscadorModalOpen}
                onClose={() => setBuscadorModalOpen(false)}
                onSelectCredito={(credito) => {
                    setSelectedCredito(credito);
                    setPagoModalOpen(true);
                }}
            />

            <PagoFormModal
                open={pagoModalOpen}
                onClose={() => setPagoModalOpen(false)}
                credito={selectedCredito}
                onSuccess={handlePaymentSuccess}
                onRefinance={handleRefinance}
            />

            <CreditoFormModal
                open={creditoModalOpen}
                onClose={() => setCreditoModalOpen(false)}
                onSuccess={() => {
                    fetchData(); // Refresh summary if needed (though loans don't affect payments instantly unless immediate quote)
                }}
                refinanceCredito={selectedCredito}
            />

            <ConfirmDialog
                open={obj_deleteDialog.open}
                title="Eliminar Préstamo"
                content={`¿Estás seguro de eliminar el préstamo de ${obj_deleteDialog.credito?.cliente?.nombre}? Esta acción es irreversible.`}
                onConfirm={handleDeleteConfirm}
                onCancel={closeDeleteDialog}
                loading={obj_deleteDialog.loading}
                confirmText="Eliminar"
                confirmColor="error"
            />

            <ConfirmDialog
                open={obj_liquidateDialog.open}
                title="Interrumpir Préstamo"
                content="¿Estás seguro de marcar este préstamo como INTERRUMPIDO? Ya no generará cuotas y se considerará pérdida."
                onConfirm={handleLiquidateConfirm}
                onCancel={closeLiquidateDialog}
                loading={obj_liquidateDialog.loading}
                confirmText="Sí, Interrumpir"
                confirmColor="primary"
            />
        </Box>
    );
};

export default Home;
