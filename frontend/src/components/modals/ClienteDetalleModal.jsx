import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Box, Typography,
    IconButton, Grid, Paper, Chip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow,
    CircularProgress, Button, Divider, useTheme, Tab, Tabs,
    DialogActions
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { creditoService } from '../../services/creditoService';
import { whatsappService } from '../../services/whatsappService';

const ClienteDetalleModal = ({ open, onClose, cliente }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [creditos, setCreditos] = useState([]);
    const [tabValue, setTabValue] = useState(0); // 0: Activos, 1: Historial
    const [confirmArchive, setConfirmArchive] = useState(false);

    useEffect(() => {
        if (open && cliente) {
            fetchCreditos();
        }
    }, [open, cliente]);

    const fetchCreditos = async () => {
        setLoading(true);
        try {
            const data = await creditoService.getCreditosByCliente(cliente.id);
            setCreditos(data || []);
        } catch (error) {
            console.error("Error cargando créditos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleArchiveCliente = async () => {
        try {
            // Import dynamically or pass as prop if cleaner, but importing directly works
            const { clienteService } = await import('../../services/clienteService');
            await clienteService.archivarCliente(cliente.id);
            onClose(); // Close modal on success
            // Ideally trigger refresh in parent
        } catch (error) {
            console.error("Error archivando cliente:", error);
        }
    };

    if (!cliente) return null;

    if (!cliente) return null;

    const activeCredits = creditos.filter(c => ['activo', 'vencido'].includes(c.estado));
    const historyCredits = creditos.filter(c => !['activo', 'vencido', 'archivado'].includes(c.estado));

    const totalPrestado = creditos.reduce((acc, curr) => acc + curr.monto_capital, 0);
    const activeDebt = activeCredits.reduce((acc, curr) => acc + (curr.saldo_capital_pendiente + curr.saldo_interes_pendiente), 0);

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: '16px', minHeight: '80vh' } }}
        >
            <Box sx={{
                p: 3,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'white'
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton onClick={onClose} sx={{ color: 'white', mr: 1, p: 0 }}>
                            <ArrowBackIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h5" fontWeight="bold">
                                {cliente.nombre} {cliente.apellido}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.8, display: 'flex', alignItems: 'center', gap: 1 }}>
                                C.C. {cliente.cedula} • {cliente.movil}
                                <IconButton
                                    size="small"
                                    sx={{ color: '#25D366', bgcolor: 'white', '&:hover': { bgcolor: '#f0f0f0' }, p: 0.5 }}
                                    onClick={() => whatsappService.sendTo(cliente.movil, '')}
                                >
                                    <WhatsAppIcon fontSize="small" />
                                </IconButton>
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Chip
                            label={`Score: ${cliente.calificacion_score ?? 100}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold', mb: 0.5 }}
                        />
                        <Typography variant="caption" display="block" sx={{ opacity: 0.8, mb: 1 }}>
                            Miembro desde {new Date(cliente.created_at).toLocaleDateString()}
                        </Typography>
                    </Box>
                </Box>

                {/* KPI Metrics */}
                <Grid container spacing={2} sx={{ mt: 3 }}>
                    <Grid item xs={4}>
                        <Paper sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)' }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Créditos Totales</Typography>
                            <Typography variant="h6" fontWeight="bold">{creditos.length}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={4}>
                        <Paper sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)' }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Total Histórico</Typography>
                            <Typography variant="h6" fontWeight="bold">{formatCurrency(totalPrestado)}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={4}>
                        <Paper sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)' }}>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>Deuda Actual</Typography>
                            <Typography variant="h6" fontWeight="bold">{formatCurrency(activeDebt)}</Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered variant="fullWidth">
                        <Tab label={`Activos (${activeCredits.length})`} />
                        <Tab label={`Historial (${historyCredits.length})`} />
                    </Tabs>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ p: 2 }}>
                        {tabValue === 0 && (
                            activeCredits.length > 0 ? (
                                activeCredits.map(credito => (
                                    <CreditCardItem key={credito.id} credito={credito} formatCurrency={formatCurrency} />
                                ))
                            ) : (
                                <EmptyState message="El cliente no tiene créditos activos." icon={<CheckCircleIcon fontSize="large" color="success" />} />
                            )
                        )}

                        {tabValue === 1 && (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Fecha</TableCell>
                                            <TableCell>Monto</TableCell>
                                            <TableCell>Estado</TableCell>
                                            <TableCell align="right">Cartera</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {historyCredits.map((credito) => {
                                            // Determinar etiqueta y color según estado unificado
                                            const getStatusInfo = () => {
                                                switch (credito.estado) {
                                                    case 'pagado': return { label: 'Pagado', color: 'success' };
                                                    case 'interrumpido': return { label: 'Interrumpido', color: 'warning' };
                                                    case 'refinanciado': return { label: 'Refinanciado', color: 'info' };
                                                    default: return { label: credito.estado, color: 'default' };
                                                }
                                            };
                                            const statusInfo = getStatusInfo();
                                            return (
                                                <TableRow key={credito.id}>
                                                    <TableCell>{new Date(credito.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell>{formatCurrency(credito.monto_capital)}</TableCell>
                                                    <TableCell>
                                                        <Chip label={statusInfo.label} size="small" color={statusInfo.color} variant="outlined" />
                                                    </TableCell>
                                                    <TableCell align="right">{credito.cartera?.nombre}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {historyCredits.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                    Sin historial previo.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                )}
            </DialogContent>

            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={onClose} variant="contained" sx={{ borderRadius: 3, px: 4 }}>
                    Cerrar
                </Button>
            </Box>
        </Dialog>
    );
};

const CreditCardItem = ({ credito, formatCurrency }) => (
    <Paper sx={{ mb: 2, p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
                {credito.cartera?.nombre}
            </Typography>
            <Chip
                label={credito.estado.toUpperCase()}
                color={credito.estado === 'vencido' ? 'error' : 'success'}
                size="small"
                sx={{ fontWeight: 'bold' }}
            />
        </Box>

        <Grid container spacing={2}>
            <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Capital Prestado</Typography>
                <Typography variant="body2">{formatCurrency(credito.monto_capital)}</Typography>
            </Grid>
            <Grid item xs={6} sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">Saldo Pendiente</Typography>
                <Typography variant="h6" color={credito.estado === 'vencido' ? 'error.main' : 'primary.main'} fontWeight="bold">
                    {formatCurrency(credito.saldo_capital_pendiente + credito.saldo_interes_pendiente)}
                </Typography>
            </Grid>
        </Grid>

        <Box sx={{ mt: 2, pt: 1, borderTop: '1px dashed', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
                Vence: {new Date(credito.fecha_vencimiento).toLocaleDateString()}
            </Typography>
            {/* Future: Add "Ver Detalle" button for specific amortization table if needed */}
        </Box>
    </Paper>
);

const EmptyState = ({ message, icon }) => (
    <Box sx={{ textAlign: 'center', py: 5, opacity: 0.7 }}>
        {icon}
        <Typography variant="body1" sx={{ mt: 1 }}>{message}</Typography>
    </Box>
);

export default ClienteDetalleModal;
