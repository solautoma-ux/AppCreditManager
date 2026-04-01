/**
 * EncargadoDetalleModal.jsx
 * Modal para mostrar detalle de un encargado con sus carteras asignadas y KPIs
 */
import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Box, Typography,
    Grid, IconButton, Paper, Chip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow,
    CircularProgress, Alert, Avatar
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AttachMoneyIcon from '@mui/icons-material/AttachMoneyRounded';
import SavingsIcon from '@mui/icons-material/SavingsRounded';
import FolderIcon from '@mui/icons-material/FolderRounded';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';

/**
 * Tarjeta de estadística con icono
 */
const StatCard = ({ title, value, color, icon }) => (
    <Paper
        elevation={0}
        sx={{
            p: 2,
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'background.paper'
        }}
    >
        <Box sx={{
            bgcolor: `${color}.lighter`,
            borderRadius: '10px',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {icon}
        </Box>
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {title}
            </Typography>
            <Typography variant="h6" fontWeight="bold" color={`${color}.main`}>
                {value}
            </Typography>
        </Box>
    </Paper>
);

/**
 * Modal de detalle de encargado
 */
const EncargadoDetalleModal = ({ open, onClose, encargado }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState({ carteras: [], totales: { saldoInicial: 0, totalPrestado: 0, saldoDisponible: 0 } });

    // Formateador de moneda
    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0
    }).format(value || 0);

    // Cargar datos al abrir el modal
    useEffect(() => {
        if (open && encargado?.id) {
            loadData();
        }
    }, [open, encargado?.id]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await userService.getCarterasEncargado(encargado.id);
            setData(result);
        } catch (err) {
            console.error('Error cargando carteras del encargado:', err);
            setError('Error al cargar las carteras asignadas');
        } finally {
            setLoading(false);
        }
    };

    // Navegar a la cartera seleccionada
    const handleCarteraClick = (cartera) => {
        onClose();
        navigate('/carteras', { state: { openCarteraId: cartera.id } });
    };

    if (!open || !encargado) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: '16px', minHeight: '50vh', bgcolor: 'background.paper', backgroundImage: 'none' } }}
        >
            {/* Header */}
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                        src={encargado.avatar_url}
                        alt={encargado.nombre}
                        sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: '1.4rem', boxShadow: 2 }}
                    >
                        {encargado.nombre?.charAt(0)}{encargado.apellido?.charAt(0)}
                    </Avatar>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, letterSpacing: 1 }}>
                            DETALLE DE ENCARGADO
                        </Typography>
                        <Typography variant="h5" fontWeight="bold">
                            {encargado.nombre} {encargado.apellido}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {encargado.email}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
                ) : (
                    <>
                        {/* KPIs */}
                        <Grid container spacing={2} sx={{ mb: 4, mt: 0 }}>
                            <Grid item xs={12} sm={4}>
                                <StatCard
                                    title="Saldo Inicial Total"
                                    value={formatCurrency(data.totales.saldoInicial)}
                                    color="primary"
                                    icon={<AccountBalanceWalletIcon color="inherit" sx={{ color: 'white' }} />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <StatCard
                                    title="Total Prestado"
                                    value={formatCurrency(data.totales.totalPrestado)}
                                    color="warning"
                                    icon={<AttachMoneyIcon color="inherit" sx={{ color: 'white' }} />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <StatCard
                                    title="Saldo Disponible"
                                    value={formatCurrency(data.totales.saldoDisponible)}
                                    color="success"
                                    icon={<SavingsIcon color="inherit" sx={{ color: 'white' }} />}
                                />
                            </Grid>
                        </Grid>

                        {/* Tabla de Carteras */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, ml: 1 }}>
                            <FolderIcon color="action" fontSize="small" sx={{ mr: 1 }} />
                            <Typography variant="subtitle1" fontWeight="bold">
                                Carteras Asignadas ({data.carteras.length})
                            </Typography>
                        </Box>

                        {data.carteras.length === 0 ? (
                            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
                                <Typography color="text.secondary">
                                    Este encargado no tiene carteras asignadas.
                                </Typography>
                            </Paper>
                        ) : (
                            <TableContainer
                                component={Paper}
                                elevation={0}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    overflow: 'hidden'
                                }}
                            >
                                <Table size="medium">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'background.neutral' }}>
                                            <TableCell sx={{ fontWeight: 'bold', py: 2 }}>Cartera</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Saldo Inicial</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>Total Prestado</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>Saldo Disponible</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.carteras.map((cartera) => (
                                            <TableRow
                                                key={cartera.id}
                                                hover
                                                onClick={() => handleCarteraClick(cartera)}
                                                sx={{ cursor: 'pointer', transition: '0.2s', '&:last-child td, &:last-child th': { border: 0 } }}
                                            >
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Typography variant="body2" fontWeight="bold">
                                                            {cartera.nombre}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ opacity: 0.8 }}>
                                                            {cartera.codigo}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {formatCurrency(cartera.monto_inicial)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'warning.dark', fontWeight: 'medium' }}>
                                                    {formatCurrency(cartera.totalPrestado)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'success.dark', fontWeight: 'bold' }}>
                                                    {formatCurrency(cartera.saldoDisponible)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Chip
                                                        label={cartera.estado?.toUpperCase()}
                                                        size="small"
                                                        color={cartera.estado === 'activa' ? 'success' : 'default'}
                                                        variant="soft"
                                                        sx={{ fontSize: '0.7rem', height: 24, fontWeight: 'bold' }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {/* Fila de totales */}
                                        <TableRow sx={{ bgcolor: 'action.hover', borderTop: '2px solid', borderColor: 'divider' }}>
                                            <TableCell sx={{ fontWeight: 'bold' }}>TOTALES</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                                {formatCurrency(data.totales.saldoInicial)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>
                                                {formatCurrency(data.totales.totalPrestado)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                                                {formatCurrency(data.totales.saldoDisponible)}
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default EncargadoDetalleModal;
