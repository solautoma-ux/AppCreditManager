import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Box, Typography,
    Grid, IconButton, Paper, Chip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow,
    CircularProgress, Alert, Divider, useTheme, useMediaQuery, Button, Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AttachMoneyIcon from '@mui/icons-material/AttachMoneyRounded';
import PersonIcon from '@mui/icons-material/PersonRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import LinkIcon from '@mui/icons-material/LinkRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import { useNavigate } from 'react-router-dom';

import { carteraService } from '../../services/carteraService';
import RetiroUtilidadModal from './RetiroUtilidadModal';
import { useAuth } from '../../context/AuthContext';

/** Tarjeta KPI en desktop: icono + label + valor, disposición horizontal */
const StatCard = ({ title, value, color, icon, action }) => (
    <Paper
        elevation={0}
        sx={{
            p: 2,
            borderRadius: '12px',
            bgcolor: `${color}.lighter`,
            border: '1px solid',
            borderColor: `${color}.light`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            height: '100%',
            boxSizing: 'border-box'
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ p: 1, bgcolor: 'white', borderRadius: '8px', color: `${color}.main` }}>
                {icon}
            </Box>
            <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    {title}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color={`${color}.dark`}>
                    {value}
                </Typography>
            </Box>
        </Box>
        {action && (
            <Box>
                {action}
            </Box>
        )}
    </Paper>
);

/**
 * Tarjeta KPI compacta para vista móvil.
 * Muestra icono pequeño, label y valor apilados verticalmente en poco espacio.
 * Se muestran 2 por fila (xs=6) para reducir el scroll vertical.
 * @param {string} title - Etiqueta del indicador
 * @param {string} value - Valor formateado
 * @param {string} color - Color MUI (primary, warning, success, secondary)
 * @param {ReactNode} icon - Ícono del indicador
 * @param {ReactNode} action - Botón de acción opcional (ej: retirar utilidad)
 */
const StatCardMobile = ({ title, value, color, icon, action }) => (
    <Paper
        elevation={0}
        sx={{
            /* Padding compacto para que quepan 2 por fila */
            p: 1.25,
            borderRadius: '10px',
            bgcolor: `${color}.lighter`,
            border: '1px solid',
            borderColor: `${color}.light`,
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
        }}
    >
        {/* Fila superior: icono pequeño + botón acción (si aplica) */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{
                p: 0.5,
                bgcolor: 'white',
                borderRadius: '6px',
                color: `${color}.main`,
                display: 'flex',
                alignItems: 'center',
                /* Icono reducido a 18px */
                '& svg': { fontSize: '1.1rem' }
            }}>
                {icon}
            </Box>
            {/* Botón de acción compacto (ej: retirar utilidad) */}
            {action && <Box>{action}</Box>}
        </Box>
        {/* Label del indicador */}
        <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="bold"
            sx={{ fontSize: '0.65rem', lineHeight: 1.2, mt: 0.25 }}
        >
            {title}
        </Typography>
        {/* Valor principal del indicador */}
        <Typography
            variant="body2"
            fontWeight="bold"
            color={`${color}.dark`}
            sx={{ fontSize: '0.82rem', lineHeight: 1.2 }}
        >
            {value}
        </Typography>
    </Paper>
);

/**
 * Modal que muestra el detalle completo de una cartera, incluyendo KPIs y listado de préstamos.
 * Implementa diseño responsivo (Tabla en Desktop, Cards en Mobile).
 * @param {Object} props
 * @param {boolean} props.open - Controla la visibilidad del modal
 * @param {Function} props.onClose - Función para cerrar el modal
 * @param {string} props.carteraId - ID de la cartera a visualizar
 * @param {Function} props.onEdit - Callback para editar la cartera
 */
const CarteraDetalleModal = ({ open, onClose, carteraId, onEdit, onRefresh }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    
    const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin';

    // Formatter
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    const theme = useTheme();
    const bol_isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        if (open && carteraId) {
            fetchDetalle();
        }
    }, [open, carteraId]);

    const fetchDetalle = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await carteraService.getCarteraDetalle(carteraId);
            setData(result);
        } catch (err) {
            setError('Error cargando detalle: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRowClick = (cliente) => {
        navigate('/creditos', { state: { searchTerm: cliente.cedula } });
        onClose();
    };

    const { cartera, creditos } = data || {};

    // Retiro Utilidad Modal State
    const [retiroModalOpen, setRetiroModalOpen] = useState(false);

    const handleRetirarSuccess = () => {
        fetchDetalle();
        if (onRefresh) onRefresh();
    };

    const sortedCreditos = React.useMemo(() => {
        if (!creditos) return [];
        return [...creditos]
            .filter(c => c.estado !== 'archivado')
            .sort((a, b) => {
                const nameA = `${a.cliente?.nombre || ''} ${a.cliente?.apellido || ''}`;
                const nameB = `${b.cliente?.nombre || ''} ${b.cliente?.apellido || ''}`;
                if (nameA !== nameB) return nameA.localeCompare(nameB);
                const dateA = new Date(a.created_at || a.fecha_inicio || 0);
                const dateB = new Date(b.created_at || b.fecha_inicio || 0);
                return dateB - dateA;
            });
    }, [creditos]);

    const dbl_totalPrestado = sortedCreditos?.reduce((sum, c) => {
        if (c.estado === 'refinanciado') return sum;
        return sum + (c.monto_capital || 0);
    }, 0) || 0;
    const dbl_totalAbonoCapital = sortedCreditos?.reduce((sum, c) => sum + (c.abono_capital || 0), 0) || 0;
    const dbl_totalAbonoInteres = sortedCreditos?.reduce((sum, c) => sum + (c.abono_interes || 0), 0) || 0;
    const dbl_totalPagado = sortedCreditos?.reduce((sum, c) => sum + (c.total_pagado || 0), 0) || 0;

    // Cálculo de Utilidad
    const utilidadDisponible = cartera ? (cartera.saldo_actual + cartera.saldo_prestado) - cartera.monto_inicial : 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { borderRadius: '16px', minHeight: '60vh' } }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pb: 1 }}>
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        DETALLE DE CARTERA
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                        {loading ? 'Cargando...' : `${cartera?.nombre || ''}`}
                    </Typography>
                    {!loading && (
                        <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                            {cartera?.codigo}
                        </Typography>
                    )}
                </Box>
                <Box>
                    {onEdit && (
                        <IconButton
                            onClick={() => {
                                onEdit(cartera);
                                // Optional: onClose(); // Keep open or close? User might want to see changes. 
                                // But CarteraFormModal onSuccess refreshes list, not this DETAIL modal data directly unless we re-fetch.
                                // We should probably close logic or implement refetch logic here.
                                // For now, let's keep it simple: Open Edit, and maybe Close Detail to force refresh from list when opening again.
                                onClose();
                            }}
                            size="small"
                            sx={{ mr: 1, bgcolor: 'primary.lighter', color: 'primary.main' }}
                        >
                            <EditIcon />
                        </IconButton>
                    )}
                    <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'action.hover' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 3, bgcolor: 'background.default' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <Box>
                        {/* KPI Cards: 2×2 en móvil con StatCardMobile, fila de 4 en desktop con StatCard */}
                        <Grid container spacing={bol_isMobile ? 1.5 : 2} sx={{ mb: 3 }}>
                            {/* Saldo Inicial */}
                            <Grid item xs={6} sm={6} md={3}>
                                {bol_isMobile ? (
                                    <StatCardMobile
                                        title="Saldo Inicial"
                                        value={formatCurrency(cartera.monto_inicial)}
                                        color="primary"
                                        icon={<AccountBalanceWalletIcon />}
                                    />
                                ) : (
                                    <StatCard
                                        title="Saldo Inicial"
                                        value={formatCurrency(cartera.monto_inicial)}
                                        color="primary"
                                        icon={<AccountBalanceWalletIcon />}
                                    />
                                )}
                            </Grid>

                            {/* Total Prestado */}
                            <Grid item xs={6} sm={6} md={3}>
                                {bol_isMobile ? (
                                    <StatCardMobile
                                        title="Total Prestado"
                                        value={formatCurrency(cartera.saldo_prestado)}
                                        color="warning"
                                        icon={<AttachMoneyIcon />}
                                    />
                                ) : (
                                    <StatCard
                                        title="Total Prestado"
                                        value={formatCurrency(cartera.saldo_prestado)}
                                        color="warning"
                                        icon={<AttachMoneyIcon />}
                                    />
                                )}
                            </Grid>

                            {/* Saldo Disponible */}
                            <Grid item xs={6} sm={6} md={3}>
                                {bol_isMobile ? (
                                    <StatCardMobile
                                        title="Saldo Disponible"
                                        value={formatCurrency(cartera.saldo_actual)}
                                        color="success"
                                        icon={<AccountBalanceWalletIcon />}
                                    />
                                ) : (
                                    <StatCard
                                        title="Saldo Disponible"
                                        value={formatCurrency(cartera.saldo_actual)}
                                        color="success"
                                        icon={<AccountBalanceWalletIcon />}
                                    />
                                )}
                            </Grid>

                            {/* Utilidad Disponible (incluye botón retirar si aplica) */}
                            <Grid item xs={6} sm={6} md={3}>
                                {bol_isMobile ? (
                                    <StatCardMobile
                                        title="Utilidad Disponible"
                                        value={formatCurrency(Math.max(0, utilidadDisponible))}
                                        color="secondary"
                                        icon={<TrendingUpIcon />}
                                        action={
                                            isAdmin && utilidadDisponible > 0 ? (
                                                <Tooltip title="Retirar">
                                                    <IconButton
                                                        size="small"
                                                        color="secondary"
                                                        onClick={() => setRetiroModalOpen(true)}
                                                        sx={{
                                                            bgcolor: 'secondary.main',
                                                            color: 'white',
                                                            /* Tamaño reducido para la vista compacta */
                                                            '&:hover': { bgcolor: 'secondary.dark' },
                                                            width: 26,
                                                            height: 26,
                                                            '& span': { fontSize: '0.9rem' }
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>💸</span>
                                                    </IconButton>
                                                </Tooltip>
                                            ) : null
                                        }
                                    />
                                ) : (
                                    <StatCard
                                        title="Utilidad Disponible"
                                        value={formatCurrency(Math.max(0, utilidadDisponible))}
                                        color="secondary"
                                        icon={<TrendingUpIcon />}
                                        action={
                                            isAdmin && utilidadDisponible > 0 ? (
                                                <Tooltip title="Retirar">
                                                    <IconButton
                                                        size="small"
                                                        color="secondary"
                                                        onClick={() => setRetiroModalOpen(true)}
                                                        sx={{
                                                            bgcolor: 'secondary.main',
                                                            color: 'white',
                                                            '&:hover': { bgcolor: 'secondary.dark' },
                                                            width: 36,
                                                            height: 36
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>💸</span>
                                                    </IconButton>
                                                </Tooltip>
                                            ) : null
                                        }
                                    />
                                )}
                            </Grid>
                        </Grid>

                        {/* Info Bar */}
                        <Paper sx={{ p: 2, mb: 3, borderRadius: '12px', display: 'flex', gap: 3, alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonIcon color="action" />
                                <Typography variant="body2" color="text.secondary">Encargado:</Typography>
                                <Typography fontWeight="bold">
                                    {cartera.encargado ? `${cartera.encargado.nombre} ${cartera.encargado.apellido}` : 'Sin asignar'}
                                </Typography>
                            </Box>
                            <Divider orientation="vertical" flexItem />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" color="text.secondary">Estado:</Typography>
                                <Chip
                                    label={cartera.estado?.toUpperCase()}
                                    size="small"
                                    color={cartera.estado === 'activa' ? 'success' : 'default'}
                                    variant="outlined"
                                    sx={{ fontWeight: 'bold' }}
                                />
                            </Box>
                        </Paper>

                        {/* Loans Table */}
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                            Historial de Préstamos
                        </Typography>
                        {/* Conditional Rendering: Mobile Cards vs Desktop Table */}
                        {bol_isMobile ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {sortedCreditos.map((credito) => (
                                    <Paper
                                        key={credito.id}
                                        elevation={0}
                                        sx={{
                                            p: 2,
                                            borderRadius: '12px',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => handleRowClick(credito.cliente)}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                            <Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {credito.cliente?.nombre} {credito.cliente?.apellido}
                                                    </Typography>
                                                    {credito.estado === 'refinanciado' && (
                                                        <LinkIcon sx={{ fontSize: 16, color: 'info.main' }} />
                                                    )}
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                                                    {credito.codigo}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={credito.estado?.toUpperCase()}
                                                size="small"
                                                color={
                                                    credito.estado === 'pagado' ? 'success' :
                                                        credito.estado === 'vencido' ? 'error' :
                                                            credito.estado === 'refinanciado' ? 'info' :
                                                                credito.estado === 'interrumpido' ? 'warning' : 'primary'
                                                }
                                                variant="filled"
                                                sx={{ height: 24, fontSize: '0.75rem', fontWeight: 'bold' }}
                                            />
                                        </Box>

                                        <Divider sx={{ mb: 2 }} />

                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary" display="block">Prestado</Typography>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {formatCurrency(credito.monto_capital)}
                                                    {credito.estado === 'refinanciado' && <Typography component="span" variant="caption" color="info.main" sx={{ ml: 0.5 }}>(R)</Typography>}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sx={{ textAlign: 'right' }}>
                                                <Typography variant="caption" color="text.secondary" display="block">Total Pagado</Typography>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {formatCurrency(credito.total_pagado)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary" display="block">Abono Capital</Typography>
                                                <Typography variant="body2" color="primary.main" fontWeight="bold">
                                                    {formatCurrency(credito.abono_capital)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sx={{ textAlign: 'right' }}>
                                                <Typography variant="caption" color="text.secondary" display="block">Abono Interés</Typography>
                                                <Typography variant="body2" color="success.main" fontWeight="bold">
                                                    {formatCurrency(credito.abono_interes)}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                ))}

                                {/* Totals Card for Mobile */}
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 2,
                                        borderRadius: '12px',
                                        bgcolor: 'action.hover', // darker background to distinguish
                                        border: '1px solid',
                                        borderColor: 'divider',
                                    }}
                                >
                                    <Typography variant="subtitle2" fontWeight="bold" align="center" sx={{ mb: 2, textTransform: 'uppercase' }}>
                                        Resumen Totales
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="text.secondary" display="block">Total Prestado</Typography>
                                            <Typography variant="body2" fontWeight="bold">
                                                {formatCurrency(dbl_totalPrestado)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{ textAlign: 'right' }}>
                                            <Typography variant="caption" color="text.secondary" display="block">Total Recaudado</Typography>
                                            <Typography variant="body2" fontWeight="bold">
                                                {formatCurrency(dbl_totalPagado)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="caption" color="text.secondary" display="block">Total Capital</Typography>
                                            <Typography variant="body2" color="primary.main" fontWeight="bold">
                                                {formatCurrency(dbl_totalAbonoCapital)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{ textAlign: 'right' }}>
                                            <Typography variant="caption" color="text.secondary" display="block">Total Interés</Typography>
                                            <Typography variant="body2" color="success.main" fontWeight="bold">
                                                {formatCurrency(dbl_totalAbonoInteres)}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </Box>
                        ) : (
                            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'background.neutral' }}>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Cliente / Código</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Monto Prestado</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Abono Capital</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>Abono Interés</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Pagado</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sortedCreditos.map((credito) => (
                                            <TableRow
                                                key={credito.id}
                                                hover
                                                onClick={() => handleRowClick(credito.cliente)}
                                                sx={{ cursor: 'pointer', transition: '0.2s' }}
                                            >
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        {credito.estado === 'refinanciado' && (
                                                            <LinkIcon sx={{ fontSize: 16, color: 'info.main', mr: 0.5 }} titleAccess="Este préstamo fue refinanciado" />
                                                        )}
                                                        <Box>
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight="bold"
                                                                sx={{
                                                                    color: credito.estado === 'refinanciado' ? 'text.secondary' : 'text.primary',
                                                                    textDecoration: credito.estado === 'refinanciado' ? 'line-through' : 'none'
                                                                }}
                                                            >
                                                                {credito.cliente?.nombre} {credito.cliente?.apellido}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {credito.codigo}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{
                                                    color: credito.estado === 'refinanciado' ? 'text.disabled' : 'inherit',
                                                    textDecoration: credito.estado === 'refinanciado' ? 'line-through' : 'none'
                                                }}>
                                                    {formatCurrency(credito.monto_capital)}
                                                    {credito.estado === 'refinanciado' && (
                                                        <Typography variant="caption" display="block" color="info.main" sx={{ textDecoration: 'none', fontSize: '0.65rem' }}>
                                                            (reciclado)
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'primary.dark' }}>
                                                    {formatCurrency(credito.abono_capital)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'success.dark', fontWeight: 'bold' }}>
                                                    {formatCurrency(credito.abono_interes)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                                    {formatCurrency(credito.total_pagado)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {(() => {
                                                        // Determine status label and color based on unified estado
                                                        switch (credito.estado) {
                                                            case 'pagado':
                                                                return <Chip label="PAGADO" size="small" color="success" variant="filled" sx={{ fontSize: '0.7rem', height: 20 }} />;
                                                            case 'interrumpido':
                                                                return <Chip label="INTERRUMPIDO" size="small" color="warning" variant="filled" sx={{ fontSize: '0.7rem', height: 20 }} />;
                                                            case 'refinanciado':
                                                                return <Chip label="REFINANCIADO" size="small" color="info" variant="filled" sx={{ fontSize: '0.7rem', height: 20 }} />;
                                                            case 'vencido':
                                                                return <Chip label="VENCIDO" size="small" color="error" variant="filled" sx={{ fontSize: '0.7rem', height: 20 }} />;
                                                            default:
                                                                return <Chip label={credito.estado?.toUpperCase()} size="small" color="primary" variant="filled" sx={{ fontSize: '0.7rem', height: 20 }} />;
                                                        }
                                                    })()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {/* Totals Row */}
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell colSpan={1} align="center" sx={{ fontWeight: 'bold' }}>TOTALES</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(dbl_totalPrestado)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(dbl_totalAbonoCapital)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.dark' }}>{formatCurrency(dbl_totalAbonoInteres)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(dbl_totalPagado)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                )}
            </DialogContent>

            {cartera && (
                <RetiroUtilidadModal
                    open={retiroModalOpen}
                    onClose={() => setRetiroModalOpen(false)}
                    cartera={cartera}
                    onSuccess={() => {
                        fetchDetalle(); // Recarga los datos dentro del modal
                    }}
                />
            )}
        </Dialog>
    );
};

export default CarteraDetalleModal;
