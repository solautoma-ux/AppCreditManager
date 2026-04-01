import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Tab, Tabs,
    IconButton, Tooltip, Chip, CircularProgress, Alert,
    Fab, useTheme
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    SavingsRounded as SavingsIcon, // Icono alcancía
    WhatsApp as WhatsAppIcon,
    Payment as PaymentIcon,
    Today as TodayIcon,
    Warning as WarningIcon,
    ErrorRounded as ErrorIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { homeService } from '../services/homeService';
import PagoFormModal from '../components/modals/PagoFormModal';
import CreditoFormModal from '../components/modals/CreditoFormModal';
import BuscadorPagoModal from '../components/modals/BuscadorPagoModal';

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

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

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

    const calculateDaysOverdue = (dateStr) => {
        if (!dateStr) return 0;
        // Parse as local date explicitly to avoid UTC conversion issues
        const [year, month, day] = dateStr.split('-').map(Number);
        const due = new Date(year, month - 1, day); // Local 00:00:00
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Local 00:00:00

        // Difference in milliseconds
        const diffTime = today - due;

        // Convert to days (floor to handle minor inconsistencies, though times are aligned)
        // If today (27) > due (27) -> 0
        // If today (27) > due (26) -> 1
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const ClientGroup = ({ group, isOverdue = false }) => {
        return (
            <Paper sx={{ p: 2, mb: 3, borderRadius: '16px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                    <Box>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                            {group.cliente?.nombre} {group.cliente?.apellido}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {group.cartera?.nombre} • {group.payments.length} {group.payments.length === 1 ? 'pago' : 'pagos'}
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                            Total: {formatCurrency(group.payments.reduce((acc, p) => acc + p.monto_cuota, 0))}
                        </Typography>
                    </Box>
                </Box>

                <Box>
                    {group.payments.map((item) => (
                        <PaymentRow key={item.id} item={item} isOverdue={isOverdue} />
                    ))}
                </Box>
            </Paper>
        );
    };

    const PaymentRow = ({ item, isOverdue = false }) => {
        const days = isOverdue ? calculateDaysOverdue(item.fecha_vencimiento) : 0;
        const severity = days > 3 ? 'error' : days > 0 ? 'warning' : 'success';

        return (
            <Box sx={{ p: 1.5, mb: 1, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: '0.2s', bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
                <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(item.monto_cuota)}
                        </Typography>
                        <Typography variant="caption" sx={{ bgcolor: 'background.default', px: 1, borderRadius: 1, fontWeight: 'medium' }}>
                            {new Date(item.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </Typography>
                        <Chip
                            label={`Cuota ${item.numero_cuota}`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        {isOverdue && days > 0 && (
                            <Chip
                                label={`${days} días`}
                                size="small"
                                color={severity}
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }}
                            />
                        )}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Pagar">
                        <IconButton size="small" color="primary" onClick={() => handlePay(item)} sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}>
                            <PaymentIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="WhatsApp">
                        <IconButton size="small" color="success" onClick={() => handleNotify(item)} sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'success.main', color: 'white' } }}>
                            <WhatsAppIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
        );
    };

    return (
        <Box sx={{ pb: 10 }}> {/* Padding bottom for FAB space */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">Hola, {user?.nombre || user?.email}</Typography>
                <Typography variant="body1" color="text.secondary">Resumen de actividades para hoy</Typography>
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

                            {todayPaymentsGrouped.length === 0 ? (
                                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4, bgcolor: 'background.paper' }}>
                                    <Typography variant="h6" color="text.secondary">🎉 ¡Todo al día!</Typography>
                                    <Typography variant="body2" color="text.secondary">No hay pagos a recibir el día de hoy.</Typography>
                                </Paper>
                            ) : (
                                todayPaymentsGrouped.map(group => (
                                    <ClientGroup key={group.cliente?.id} group={group} />
                                ))
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

                            {overduePaymentsGrouped.length === 0 ? (
                                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4, bgcolor: 'background.paper' }}>
                                    <Typography variant="h6" color="text.secondary">✨ ¡Excelente!</Typography>
                                    <Typography variant="body2" color="text.secondary">No hay pagos pendientes de días anteriores.</Typography>
                                </Paper>
                            ) : (
                                overduePaymentsGrouped.map(group => (
                                    <ClientGroup key={group.cliente?.id} group={group} isOverdue={true} />
                                ))
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

                            {vencidoPaymentsGrouped.length === 0 ? (
                                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4, bgcolor: 'background.paper' }}>
                                    <Typography variant="h6" color="text.secondary">✅ Sin Cartera Vencida</Typography>
                                    <Typography variant="body2" color="text.secondary">No tienes créditos en estado 'Vencido'.</Typography>
                                </Paper>
                            ) : (
                                vencidoPaymentsGrouped.map(group => (
                                    <ClientGroup key={group.cliente?.id} group={group} isOverdue={true} />
                                ))
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
        </Box>
    );
};

export default Home;
