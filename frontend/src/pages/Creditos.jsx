import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Button, Grid,
    TextField, InputAdornment, Chip, IconButton, Tooltip,
    CircularProgress, Alert, LinearProgress, ToggleButtonGroup, ToggleButton,
    useMediaQuery, useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import AttachMoneyIcon from '@mui/icons-material/AttachMoneyRounded';
import CalendarTodayIcon from '@mui/icons-material/CalendarTodayRounded';
import PaymentIcon from '@mui/icons-material/PaymentRounded';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import AutorenewIcon from '@mui/icons-material/AutorenewRounded';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import GridViewIcon from '@mui/icons-material/GridViewRounded';
import ViewListIcon from '@mui/icons-material/ViewListRounded';
import SortByAlphaIcon from '@mui/icons-material/SortByAlphaRounded';
import TableChartIcon from '@mui/icons-material/TableChartRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';

import CreditoFormModal from '../components/modals/CreditoFormModal';
import PagoFormModal from '../components/modals/PagoFormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import CreditoCardBase from '../components/common/CreditoCardBase';
import { creditoService } from '../services/creditoService';
import { whatsappService } from '../services/whatsappService';
import { useAuth } from '../context/AuthContext';
import { useCreditoActions } from '../hooks/useCreditoActions';
import { useToast } from '../context/ToastContext';

const CreditoCard = ({ credito, onPay, onClick, onDelete, onLiquidate, onRefinance, onWhatsApp }) => {
    // Calcular progreso
    const saldoPendiente = (credito.saldo_capital_pendiente || 0) + (credito.saldo_interes_pendiente || 0);
    const totalPagado = credito.monto_total - saldoPendiente;
    const progreso = (totalPagado / credito.monto_total) * 100;

    // Formato
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);
    const formatDate = (str) => str ? new Date(str + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : 'N/A';

    // Estados terminados (ya no activos ni vencidos)
    const ESTADOS_TERMINADOS = ['pagado', 'interrumpido', 'refinanciado'];
    const isTerminado = ESTADOS_TERMINADOS.includes(credito.estado);

    const getStatusInfo = () => {
        switch (credito.estado) {
            case 'activo': return { label: 'ACTIVO', color: 'primary' };
            case 'vencido': return { label: 'VENCIDO', color: 'error' };
            case 'pagado': return { label: 'PAGADO', color: 'success' };
            case 'interrumpido': return { label: 'INTERRUMPIDO', color: 'warning' };
            case 'refinanciado': return { label: 'REFINANCIADO', color: 'info' };
            default: return { label: credito.estado?.toUpperCase() || 'DESCONOCIDO', color: 'default' };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <Paper
            elevation={0}
            onClick={() => onClick(credito)}
            sx={{
                p: 3,
                borderRadius: '16px',
                border: '2px solid',
                borderColor: isTerminado
                    ? (statusInfo.color === 'warning' ? 'warning.main' : statusInfo.color === 'info' ? 'info.main' : 'success.main')
                    : (credito.estado === 'vencido' ? 'error.main' : 'divider'),
                bgcolor: isTerminado
                    ? (statusInfo.color === 'warning' ? 'warning.lighter' : statusInfo.color === 'info' ? 'rgba(2, 136, 209, 0.04)' : 'rgba(76, 175, 80, 0.03)')
                    : 'background.paper',
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: isTerminado
                        ? (statusInfo.color === 'warning' ? 'warning.main' : statusInfo.color === 'info' ? 'info.main' : 'success.main')
                        : (credito.estado === 'vencido' ? 'error.main' : 'primary.main'),
                    boxShadow: isTerminado
                        ? '0 12px 24px -10px rgba(0,0,0,0.1)'
                        : '0 12px 24px -10px rgba(59, 130, 246, 0.15)'
                }
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight="bold">
                        {credito.cliente?.nombre} {credito.cliente?.apellido}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {credito.cartera?.nombre}
                    </Typography>
                </Box>
                <Chip
                    label={statusInfo.label}
                    size="small"
                    color={statusInfo.color}
                    variant={isTerminado ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 'bold' }}
                />
            </Box>

            <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Deuda Total</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatCurrency(credito.monto_total)}</Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Pagado</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                        {formatCurrency(totalPagado)}
                    </Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Pendiente</Typography>
                    <Typography variant="body2" fontWeight="bold" color={isTerminado ? 'success.main' : 'error.main'}>
                        {formatCurrency(saldoPendiente)}
                    </Typography>
                </Grid>
            </Grid>

            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption">Progreso</Typography>
                    <Typography variant="caption">{progreso.toFixed(0)}%</Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={Math.min(progreso, 100)}
                    sx={{ borderRadius: 2, height: 6 }}
                    color={isTerminado ? 'success' : 'primary'}
                />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'text.secondary',
                    fontSize: '0.85rem',
                    bgcolor: 'background.default',
                    p: 1,
                    borderRadius: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarTodayIcon fontSize="small" />
                        <span>Prox: {formatDate(credito.fecha_proximo_pago)}</span>
                    </Box>
                    {(credito.tasa_interes !== undefined && credito.tasa_interes !== null) && (
                        <Typography variant="caption" fontWeight="bold" sx={{ color: 'text.secondary' }}>
                            Tasa: {credito.tasa_interes}%
                        </Typography>
                    )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {!isTerminado && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<AttachMoneyIcon />}
                            onClick={(e) => { e.stopPropagation(); onPay(credito); }}
                            sx={{ borderRadius: '8px', textTransform: 'none', flexGrow: 1 }}
                        >
                            Cobrar
                        </Button>
                    )}
                    {!isTerminado && credito.cliente?.movil && (
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<WhatsAppIcon />}
                            onClick={(e) => { e.stopPropagation(); onWhatsApp(credito); }}
                            sx={{
                                color: '#25D366', borderColor: '#25D366', borderRadius: '8px', textTransform: 'none', flexGrow: 1,
                                '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.1)', borderColor: '#25D366' }
                            }}
                        >
                            Notificar
                        </Button>
                    )}
                    {!isTerminado && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="info"
                            startIcon={<AutorenewIcon />}
                            onClick={(e) => { e.stopPropagation(); onRefinance(credito); }}
                            sx={{ borderRadius: '8px', textTransform: 'none', flexGrow: 1 }}
                        >
                            Refinanciar
                        </Button>
                    )}
                    {!isTerminado && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<CheckCircleIcon />}
                            onClick={(e) => { e.stopPropagation(); onLiquidate(credito); }}
                            sx={{ borderRadius: '8px', textTransform: 'none', flexGrow: 1 }}
                        >
                            Interrumpir
                        </Button>
                    )}
                    {credito.estado === 'activo' && totalPagado === 0 && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => { e.stopPropagation(); onDelete(credito); }}
                            sx={{ borderRadius: '8px', textTransform: 'none', flexGrow: 1 }}
                        >
                            Borrar
                        </Button>
                    )}
                </Box>
            </Box>
        </Paper>
    );
};

const Creditos = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const theme = useTheme();
    /** Detecta pantalla móvil para aplicar diseño compacto en los KPI cards */
    const bol_isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [creditos, setCreditos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [pagoModalOpen, setPagoModalOpen] = useState(false);
    const [detalleModalOpen, setDetalleModalOpen] = useState(false);
    const [selectedCredito, setSelectedCredito] = useState(null);
    const [filterStatus, setFilterStatus] = useState('activo');
    const [searchTerm, setSearchTerm] = useState('');
    const [groupBy, setGroupBy] = useState('none'); // none | month | year

    // View Mode & Sorting
    const [viewMode, setViewMode] = useState('card'); // 'card' | 'list'
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

    const fetchCreditos = async () => {
        setLoading(true);
        try {
            const data = await creditoService.getCreditos();
            setCreditos(data || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const {
        obj_deleteDialog,
        obj_liquidateDialog,
        handleDeleteClick,
        handleDeleteConfirm,
        closeDeleteDialog,
        handleLiquidateClick,
        handleLiquidateConfirm,
        closeLiquidateDialog
    } = useCreditoActions(fetchCreditos);

    useEffect(() => {
        fetchCreditos();
    }, []);

    const handlePay = (credito) => {
        setSelectedCredito(credito);
        setPagoModalOpen(true);
    };

    const handleCardClick = (credito) => {
        // Al hacer click general en un crédito, abrimos el Formulario de Detalle/Pago 
        // para que puedan ver su historial aunque esté pagado o vencido
        setSelectedCredito(credito);
        setPagoModalOpen(true);
    };

    const handleRefinance = (credito) => {
        setSelectedCredito(credito);
        setModalOpen(true);
    };

    /**
     * Sends WhatsApp message with payment reminder including amount and custom message.
     */
    const handleWhatsAppCredito = (credito) => {
        const cliente = credito.cliente;
        if (!cliente?.movil) return;

        // Calculate pending balance
        const dbl_saldoPendiente = (credito.saldo_capital_pendiente || 0) + (credito.saldo_interes_pendiente || 0);
        const str_saldoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(dbl_saldoPendiente);

        // Build message with payment info
        const str_mensaje = `Hola ${cliente.nombre}, le recordamos que tiene un saldo pendiente de ${str_saldoFormateado}.`;

        // Append custom suffix from admin config if available
        const str_customSuffix = user?.whatsapp_mensaje_custom || '';

        whatsappService.sendTo(cliente.movil, str_mensaje, str_customSuffix);
    };

    // Estados terminados para filtrado
    const ESTADOS_TERMINADOS = ['pagado', 'interrumpido', 'refinanciado'];

    const filtered = creditos.filter(c => {
        // Exclude archived by default (unless we add an archive view later)
        if (c.estado === 'archivado') return false;

        let matchesStatus;
        if (filterStatus === 'todos') {
            matchesStatus = true;
        } else {
            // Filtrado estricto por estado (activo, vencido, pagado, refinanciado, interrumpido)
            matchesStatus = c.estado === filterStatus;
        }
        const matchesSearch = c.cliente?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.cliente?.apellido?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    // Helper: Group items by date
    const groupItemsByDate = (items, type) => {
        if (type === 'none') return { 'Todos': items };

        return items.reduce((groups, item) => {
            const date = new Date(item.created_at);
            let key = '';

            if (type === 'month') {
                const month = date.toLocaleString('es-CO', { month: 'long' });
                const year = date.getFullYear();
                key = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
            } else if (type === 'year') {
                key = date.getFullYear().toString();
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
            return groups;
        }, {});
    };

    const groupedCreditos = groupItemsByDate(filtered, groupBy);
    const sortedGroupKeys = Object.keys(groupedCreditos).sort((a, b) => {
        // Sort keys descending (assumption: keys contain Year for sorting)
        // Simple trick: extract year number and compare
        const yearA = parseInt(a.match(/\d{4}/)?.[0] || 0);
        const yearB = parseInt(b.match(/\d{4}/)?.[0] || 0);
        if (yearA !== yearB) return yearB - yearA;

        // If same year (Month grouping), sort by month index
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthA = months.find(m => a.includes(m)) || '';
        const monthB = months.find(m => b.includes(m)) || '';
        return months.indexOf(monthB) - months.indexOf(monthA);
    });

    // --- SORTING LOGIC FOR CARDS & LIST (Name Default) ---
    const sortByName = (list) => {
        return [...list].sort((a, b) => {
            const nameA = `${a.cliente?.nombre || ''} ${a.cliente?.apellido || ''}`.toLowerCase();
            const nameB = `${b.cliente?.nombre || ''} ${b.cliente?.apellido || ''}`.toLowerCase();
            return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    };

    // Apply sorting to flat list (for 'none' grouping)
    const sortedFiltered = groupBy === 'none' ? sortByName(filtered) : filtered;

    // Apply sorting inside groups
    if (groupBy !== 'none') {
        sortedGroupKeys.forEach(key => {
            groupedCreditos[key] = sortByName(groupedCreditos[key]);
        });
    }

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    // KPIs
    const totalPrestado = creditos.reduce((acc, curr) => acc + (curr.estado === 'activo' ? curr.monto_capital : 0), 0);
    const totalInteresEsperado = creditos.reduce((acc, curr) => acc + (curr.estado === 'activo' ? curr.monto_interes_calculado : 0), 0);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">Préstamos</Typography>
                    <Typography variant="body1" color="text.secondary">Gestiona tus préstamos activos</Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setSelectedCredito(null);
                        setModalOpen(true);
                    }}
                    sx={{ borderRadius: 3, px: 3 }}
                >
                    Nuevo Préstamo
                </Button>
            </Box>

            {/* KPIs: 2 por fila en móvil (xs=6 compacto), lado a lado en desktop (sm=6) */}
            <Grid container spacing={bol_isMobile ? 1.5 : 2} sx={{ mb: 4 }}>
                {/* Card Capital Activo */}
                <Grid item xs={6} sm={6}>
                    <Paper sx={{
                        /* Padding compacto en móvil, normal en desktop */
                        p: bol_isMobile ? 1.5 : 3,
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: bol_isMobile ? 'column' : 'row',
                        alignItems: bol_isMobile ? 'flex-start' : 'center',
                        gap: bol_isMobile ? 0.75 : 2,
                        height: '100%'
                    }}>
                        {/* Icono: tamaño reducido en móvil */}
                        <Box sx={{
                            p: bol_isMobile ? 0.75 : 1.5,
                            bgcolor: 'primary.light',
                            color: 'primary.main',
                            borderRadius: bol_isMobile ? 2 : 3,
                            display: 'flex',
                            alignItems: 'center',
                            '& svg': { fontSize: bol_isMobile ? '1rem' : '1.5rem' }
                        }}>
                            <AttachMoneyIcon />
                        </Box>
                        <Box>
                            {/* Label más pequeño en móvil */}
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: bol_isMobile ? '0.65rem' : '0.75rem', display: 'block', lineHeight: 1.2 }}
                            >
                                Capital Activo (Prestado)
                            </Typography>
                            {/* Valor: h6 en móvil en lugar de h5 */}
                            <Typography
                                variant={bol_isMobile ? 'body2' : 'h5'}
                                fontWeight="bold"
                                sx={{ fontSize: bol_isMobile ? '0.9rem' : undefined, lineHeight: 1.3, mt: bol_isMobile ? 0.25 : 0 }}
                            >
                                {formatCurrency(totalPrestado)}
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>

                {/* Card Ganancia Esperada */}
                <Grid item xs={6} sm={6}>
                    <Paper sx={{
                        /* Padding compacto en móvil, normal en desktop */
                        p: bol_isMobile ? 1.5 : 3,
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: bol_isMobile ? 'column' : 'row',
                        alignItems: bol_isMobile ? 'flex-start' : 'center',
                        gap: bol_isMobile ? 0.75 : 2,
                        height: '100%'
                    }}>
                        {/* Icono: tamaño reducido en móvil */}
                        <Box sx={{
                            p: bol_isMobile ? 0.75 : 1.5,
                            bgcolor: 'success.light',
                            color: 'success.main',
                            borderRadius: bol_isMobile ? 2 : 3,
                            display: 'flex',
                            alignItems: 'center',
                            '& svg': { fontSize: bol_isMobile ? '1rem' : '1.5rem' }
                        }}>
                            <AttachMoneyIcon />
                        </Box>
                        <Box>
                            {/* Label más pequeño en móvil */}
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: bol_isMobile ? '0.65rem' : '0.75rem', display: 'block', lineHeight: 1.2 }}
                            >
                                Ganancia Esperada
                            </Typography>
                            {/* Valor: body2 en móvil en lugar de h5 */}
                            <Typography
                                variant={bol_isMobile ? 'body2' : 'h5'}
                                fontWeight="bold"
                                color="success.main"
                                sx={{ fontSize: bol_isMobile ? '0.9rem' : undefined, lineHeight: 1.3, mt: bol_isMobile ? 0.25 : 0 }}
                            >
                                +{formatCurrency(totalInteresEsperado)}
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Actions */}
            <Paper sx={{ p: 2, borderRadius: '16px', mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    placeholder="Buscar por cliente..."
                    size="small"
                    sx={{ flexGrow: 1, minWidth: 200 }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                        sx: { borderRadius: 3 }
                    }}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                    <ToggleButtonGroup
                        value={filterStatus}
                        exclusive
                        onChange={(e, v) => {
                            if (v) {
                                setFilterStatus(v);
                                // Reset groupBy when switching to activo or other active states if logic requires
                                if (v === 'activo') setGroupBy('none');
                            }
                        }}
                        size="small"
                    >
                        <ToggleButton value="activo" sx={{ borderRadius: '12px 0 0 12px', px: 2 }}>Activos</ToggleButton>
                        <ToggleButton value="vencido" sx={{ px: 2 }}>Vencidos</ToggleButton>
                        <ToggleButton value="pagado" sx={{ px: 2 }}>Pagados</ToggleButton>
                        <ToggleButton value="todos" sx={{ borderRadius: '0 12px 12px 0', px: 2 }}>Todos</ToggleButton>
                    </ToggleButtonGroup>

                    {/* Date Grouping Toggle - only for Historic statuses */}
                    {(filterStatus === 'pagado' || filterStatus === 'todos') && (
                        <ToggleButtonGroup
                            value={groupBy}
                            exclusive
                            onChange={(e, v) => v && setGroupBy(v)}
                            size="small"
                            sx={{ ml: 1 }}
                        >
                            <ToggleButton value="none" sx={{ borderRadius: '12px 0 0 12px', px: 2 }}>Sin Filtro</ToggleButton>
                            <ToggleButton value="month" sx={{ px: 2 }}>Mes-Año</ToggleButton>
                            <ToggleButton value="year" sx={{ borderRadius: '0 12px 12px 0', px: 2 }}>Año</ToggleButton>
                        </ToggleButtonGroup>
                    )}

                    {/* View Mode Toggle */}
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(e, v) => v && setViewMode(v)}
                        size="small"
                        sx={{ ml: 2 }}
                    >
                        <ToggleButton value="card" sx={{ borderRadius: '12px 0 0 12px', px: 1 }} title="Vista Tarjetas">
                            <GridViewIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="list" sx={{ borderRadius: '0 12px 12px 0', px: 1 }} title="Vista Lista">
                            <ViewListIcon fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <Box>
                    {filtered.length === 0 ? (
                        <Grid item xs={12}>
                            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: '16px' }}>
                                <Typography color="text.secondary">No hay préstamos {filterStatus === 'activo' ? 'activos' : ''}.</Typography>
                            </Paper>
                        </Grid>
                    ) : viewMode === 'list' && groupBy === 'none' ? (
                        /* LIST VIEW (Table) */
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '16px' }}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'background.neutral' }}>
                                        <TableCell
                                            sx={{ cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}
                                            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                                        >
                                            Cliente {sortDirection === 'asc' ? '↑' : '↓'}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Cartera</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Prestado</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Deuda Total</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>Pendiente</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sortedFiltered.map((credito) => {
                                        const saldoPendiente = (credito.saldo_capital_pendiente || 0) + (credito.saldo_interes_pendiente || 0);
                                        const totalPagado = credito.monto_total - saldoPendiente;
                                        return (
                                            <TableRow key={credito.id} hover onClick={() => handleCardClick(credito)} sx={{ cursor: 'pointer' }}>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {credito.cliente?.nombre} {credito.cliente?.apellido}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {credito.codigo}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>{credito.cartera?.nombre}</TableCell>
                                                <TableCell align="right">{formatCurrency(credito.monto_capital)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(credito.monto_total)}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                                    {formatCurrency(saldoPendiente)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Chip
                                                        label={credito.estado?.toUpperCase()}
                                                        size="small"
                                                        color={['activo'].includes(credito.estado) ? 'primary' : credito.estado === 'vencido' ? 'error' : credito.estado === 'refinanciado' ? 'info' : 'success'}
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                                        {/* WhatsApp */}
                                                        {!['pagado', 'interrumpido', 'refinanciado'].includes(credito.estado) && credito.cliente?.movil && (
                                                            <Tooltip title="WhatsApp Pagar">
                                                                <IconButton size="small" sx={{ color: '#25D366' }} onClick={(e) => { e.stopPropagation(); handleWhatsAppCredito(credito); }}>
                                                                    <WhatsAppIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        {/* Pay / Refinance */}
                                                        {!['pagado', 'interrumpido', 'refinanciado'].includes(credito.estado) && (
                                                            <>
                                                                <Tooltip title="Pagar">
                                                                    <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); handlePay(credito); }}>
                                                                        <AttachMoneyIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Refinanciar">
                                                                    <IconButton size="small" color="info" onClick={(e) => { e.stopPropagation(); handleRefinance(credito); }}>
                                                                        <AutorenewIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </>
                                                        )}
                                                        {/* Interrumpir */}
                                                        {!['pagado', 'interrumpido', 'refinanciado'].includes(credito.estado) && (
                                                            <Tooltip title="Interrumpir">
                                                                <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleLiquidateClick(credito); }}>
                                                                    <CheckCircleIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        {/* Eliminar (solo si activo y sin pagos) */}
                                                        {credito.estado === 'activo' && totalPagado === 0 && (
                                                            <Tooltip title="Eliminar">
                                                                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteClick(credito); }}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : groupBy === 'none' ? (
                        /* Flat List CARD (Original) */
                        <Grid container spacing={2}>
                            {sortedFiltered.map(credito => (
                                <Grid item xs={12} md={6} key={credito.id}>
                                    <CreditoCard
                                        credito={credito}
                                        onPay={handlePay}
                                        onClick={handleCardClick}
                                        onDelete={handleDeleteClick}
                                        onLiquidate={handleLiquidateClick}
                                        onRefinance={handleRefinance}
                                        onWhatsApp={handleWhatsAppCredito}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        /* Grouped List */
                        sortedGroupKeys.map(key => (
                            <Box key={key} sx={{ mb: 4 }}>
                                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary', borderLeft: '4px solid', borderColor: 'primary.main', pl: 2 }}>
                                    {key}
                                </Typography>
                                <Grid container spacing={2}>
                                    {groupedCreditos[key].map(credito => (
                                        <Grid item xs={12} md={6} key={credito.id}>
                                            <CreditoCard
                                                credito={credito}
                                                onPay={handlePay}
                                                onClick={handleCardClick}
                                                onDelete={handleDeleteClick}
                                                onLiquidate={handleLiquidateClick}
                                                onRefinance={handleRefinance}
                                                onWhatsApp={handleWhatsAppCredito}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        ))
                    )}
                </Box>
            )}

            <CreditoFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchCreditos}
                refinanceCredito={selectedCredito}
            />

            <PagoFormModal
                open={pagoModalOpen}
                onClose={() => setPagoModalOpen(false)}
                credito={selectedCredito}
                onSuccess={fetchCreditos}
                onRefinance={handleRefinance}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={obj_deleteDialog.open}
                onClose={closeDeleteDialog}
                onConfirm={handleDeleteConfirm}
                title="Eliminar Préstamo"
                message={`¿Está seguro que desea ELIMINAR permanentemente el préstamo "${obj_deleteDialog.credito?.codigo}"? El capital prestado se devolverá a la cartera.`}
                confirmText="Eliminar"
                severity="error"
                loading={obj_deleteDialog.loading}
            />

            {/* Interrupt Confirmation Dialog */}
            <ConfirmDialog
                open={obj_liquidateDialog.open}
                onClose={closeLiquidateDialog}
                onConfirm={handleLiquidateConfirm}
                title="Interrumpir Préstamo"
                message={`¿Está seguro que desea INTERRUMPIR el préstamo "${obj_liquidateDialog.credito?.codigo}"? El cliente no pagará la deuda pendiente. El capital restante se considerará como PERDIDO.`}
                confirmText="Interrumpir"
                severity="warning"
                loading={obj_liquidateDialog.loading}
            />
        </Box>
    );
};

export default Creditos;
