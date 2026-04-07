import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    TextField,
    InputAdornment,
    Chip,
    Grid,
    Avatar,
    Divider,
    Tabs,
    Tab,
    CircularProgress,
    Tooltip,
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchRounded';
import AddIcon from '@mui/icons-material/AddRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import BlockIcon from '@mui/icons-material/BlockRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongRounded';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthRounded';
import AttachMoneyIcon from '@mui/icons-material/AttachMoneyRounded';
import GroupsIcon from '@mui/icons-material/GroupsRounded';
import AutorenewIcon from '@mui/icons-material/AutorenewRounded';
import ViewModuleIcon from '@mui/icons-material/ViewModuleRounded';
import ViewListIcon from '@mui/icons-material/ViewListRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import UserFormModal from '../components/modals/UserFormModal';
import PaymentHistoryModal from '../components/modals/PaymentHistoryModal';
import RenewalModal from '../components/modals/RenewalModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { userService } from '../services/userService';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';

/**
 * Mapeo de etiquetas legibles para cada tipo de plan de suscripción
 */
const PLAN_LABELS = {
    mensual: 'Mensual',
    anual: 'Anual',
    prueba_gratis: 'Prueba Gratis'
};

/**
 * Formateador de moneda colombiana
 * @param {number} value - Valor numérico a formatear
 * @returns {string} Valor formateado en COP
 */
const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
};

/**
 * Formateador de fecha en formato legible colombiano
 * @param {string} dateStr - Fecha en formato ISO (YYYY-MM-DD)
 * @returns {string} Fecha formateada (ej: "09 feb 2026")
 */
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    // Parsear manualmente para evitar problemas de timezone (UTC a Local)
    // Supabase devuelve YYYY-MM-DD. Al hacer new Date("YYYY-MM-DD"), JS asume UTC 00:00.
    // En Colombia (UTC-5), eso es el día anterior a las 19:00.
    // Solución: Crear la fecha usando componentes locales: new Date(y, m-1, d)
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};


// ─────────────────────────────────────────────────────────────────────────────
// Componente: AdminCard (Tarjeta individual de suscriptor)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tarjeta visual que muestra la información de un suscriptor (admin).
 * Incluye datos del plan, fecha de vencimiento, estado y acciones rápidas.
 */
const AdminCard = ({ admin, onViewHistory, onEdit, onToggleStatus, onWhatsApp, onRenew, onDelete }) => {
    const isActive = admin.estado === 'activo';
    const isPending = admin.estado === 'pendiente';

    // Datos de suscripción (snake_case directo de Supabase)
    const sub = admin.suscripcion || {};
    
    // Cálculo de mora en tiempo real vs fecha DB
    let int_diasMora = 0;
    if (sub.fecha_proximo_pago) {
        // Parsear fechas asumiendo misma hora para precisión de días completos
        const [y, m, d] = sub.fecha_proximo_pago.split('T')[0].split('-').map(Number);
        const dueDate = new Date(y, m - 1, d);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalizar a medianoche de hoy

        if (today > dueDate) {
            int_diasMora = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        }
    }
    
    const bol_hasMora = int_diasMora > 0;
    const str_tipoPlan = sub.tipo_plan || 'mensual';

    // Calcular si está próximo a vencer (menos de 5 días)
    const bol_aboutToExpire = !bol_hasMora && sub.fecha_proximo_pago &&
        (new Date(sub.fecha_proximo_pago) - new Date() < 5 * 24 * 60 * 60 * 1000) &&
        (new Date(sub.fecha_proximo_pago) > new Date());

    /**
     * Determinar el label y color del chip de estado
     */
    const getStatusChip = () => {
        if (isPending) return { label: 'Pendiente', color: 'warning' };
        if (admin.estado === 'inactivo') return { label: 'Inactivo', color: 'default' };
        return { label: 'Activo', color: 'success' };
    };

    const statusChip = getStatusChip();

    return (
        <Paper
            sx={{
                p: 3,
                borderRadius: '12px',
                mb: 2,
                border: '1px solid',
                borderColor: bol_hasMora ? 'error.light' : (bol_aboutToExpire ? 'warning.light' : 'divider'),
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Indicador lateral rojo para morosos */}
            {bol_hasMora && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', bgcolor: 'error.main' }} />
            )}

            {/* Header: Avatar, Nombre, Estado */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, pl: bol_hasMora ? 1 : 0 }}>
                <Avatar
                    src={admin.avatar_url}
                    sx={{ width: 56, height: 56, bgcolor: isPending ? 'grey.400' : 'primary.main', fontSize: '1.2rem' }}
                >
                    {admin.nombre?.charAt(0)}{admin.apellido?.charAt(0)}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                        {admin.nombre} {admin.apellido}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {admin.email}
                    </Typography>
                </Box>
                <Chip
                    size="small"
                    label={statusChip.label}
                    color={statusChip.color}
                    variant="outlined"
                    sx={{ borderRadius: '6px' }}
                />
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Info del Plan y Financiera */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Tipo Plan</Typography>
                    <Typography variant="subtitle2" fontWeight="bold">
                        {PLAN_LABELS[str_tipoPlan] || str_tipoPlan}
                    </Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Monto</Typography>
                    <Typography variant="subtitle2" fontWeight="bold">
                        {str_tipoPlan === 'prueba_gratis' ? 'Gratis' : formatCurrency(sub.monto_mensual)}
                    </Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">Total Pagado</Typography>
                    <Typography variant="subtitle2" fontWeight="bold" color="success.main">
                        {formatCurrency(sub.total_pagado)}
                    </Typography>
                </Grid>
            </Grid>

            {/* Fecha de vencimiento SIEMPRE visible */}
            <Box sx={{
                p: 1.5,
                borderRadius: '8px',
                bgcolor: bol_hasMora ? 'error.50' : (bol_aboutToExpire ? 'warning.50' : 'action.hover'),
                color: bol_hasMora ? 'error.900' : (bol_aboutToExpire ? 'warning.900' : 'text.primary'),
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarMonthIcon fontSize="small" />
                        <Typography variant="body2" fontWeight="bold">
                            Vence: {formatDate(sub.fecha_proximo_pago)}
                        </Typography>
                    </Box>
                    {bol_hasMora && (
                        <Typography variant="caption" fontWeight="bold" color="error.main">
                            ¡{int_diasMora} días de retraso!
                        </Typography>
                    )}
                </Box>
                {bol_hasMora ? (
                    <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<WhatsAppIcon />}
                        onClick={() => onWhatsApp(admin)}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                    >
                        Cobrar
                    </Button>
                ) : !isPending && sub.fecha_proximo_pago ? (
                    <Chip label="Al día" color="success" size="small" sx={{ borderRadius: '6px' }} />
                ) : null}
            </Box>

            {/* Acciones */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Ver Historial de Pagos */}
                <Tooltip title="Ver Historial de Pagos">
                    <Button size="small" variant="outlined" onClick={() => onViewHistory(admin)} sx={{ borderRadius: '8px', minWidth: 40, px: 1 }}>
                        <ReceiptLongIcon />
                    </Button>
                </Tooltip>

                {/* Editar datos */}
                <Tooltip title="Editar Datos">
                    <Button size="small" variant="outlined" onClick={() => onEdit(admin)} sx={{ borderRadius: '8px', minWidth: 40, px: 1 }}>
                        <EditIcon />
                    </Button>
                </Tooltip>

                {/* Renovar suscripción (solo para activos o vencidos) */}
                {!isPending && (
                    <Tooltip title="Renovar Suscripción">
                        <Button size="small" variant="outlined" color="primary" onClick={() => onRenew(admin)} sx={{ borderRadius: '8px', minWidth: 40, px: 1 }}>
                            <AutorenewIcon />
                        </Button>
                    </Tooltip>
                )}

                {/* Activar / Desactivar */}
                {!isPending && (
                    <Button
                        size="small"
                        variant={isActive ? 'outlined' : 'contained'}
                        color={isActive ? 'error' : 'success'}
                        startIcon={isActive ? <BlockIcon /> : <CheckCircleIcon />}
                        onClick={() => onToggleStatus(admin)}
                        sx={{ borderRadius: '8px' }}
                    >
                        {isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                )}

                {/* Eliminar (Solo si no es pendiente o si se permite borrar pendientes) */}
                <Tooltip title="Eliminar Admin">
                    <Button size="small" variant="outlined" color="error" onClick={() => onDelete(admin)} sx={{ borderRadius: '8px', minWidth: 40, px: 1 }}>
                        <DeleteIcon />
                    </Button>
                </Tooltip>
            </Box>
        </Paper>
    );
};


// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal: Suscripciones (Gestión completa)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Página principal de Gestión de Suscripciones.
 * Muestra KPIs, pestañas de filtrado (Todos/Próximos/Vencidos),
 * buscador, toggle cards/tabla, y acciones rápidas por cada suscriptor.
 */
const Suscripciones = () => {
    const { showToast } = useToast();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTab, setCurrentTab] = useState(0); // 0: Todos, 1: Próximos, 2: Vencidos
    const [viewMode, setViewMode] = useState('cards'); // 'cards' o 'table'

    // Estados de Modales
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [renewalModalOpen, setRenewalModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedAdmin, setSelectedAdmin] = useState(null);

    // ─── Fetch ──────────────────────────────────────────────────────────────────

    /** Obtener lista de administradores con datos de suscripción */
    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const data = await userService.getUsers('admin');
            setAdmins(data || []);
        } catch (err) {
            console.error('Error fetching admins:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    // ─── KPIs ───────────────────────────────────────────────────────────────────

    /** Cálculo de indicadores clave en tiempo real desde los datos cargados */
    const kpis = {
        totalSuscriptores: admins.filter(a => a.estado === 'activo').length,
        totalRecaudado: admins.reduce((sum, a) => sum + (a.suscripcion?.total_pagado || 0), 0),
        totalDeuda: admins.reduce((sum, a) => {
            const int_dias = a.suscripcion?.dias_mora || 0;
            const dbl_monto = a.suscripcion?.monto_mensual || 0;
            return sum + (int_dias > 0 ? dbl_monto : 0);
        }, 0)
    };

    // ─── Filtros ────────────────────────────────────────────────────────────────

    /** Filtra la lista de admins según searchTerm y pestaña activa */
    const filteredAdmins = admins.filter(admin => {
        // Filtro por texto de búsqueda
        const matchesSearch =
            (admin.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (admin.email || '').toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // Filtro por pestaña
        const sub = admin.suscripcion || {};
        const int_diasMora = sub.dias_mora || 0;
        const int_daysToExpiry = sub.fecha_proximo_pago
            ? Math.ceil((new Date(sub.fecha_proximo_pago) - new Date()) / (1000 * 60 * 60 * 24))
            : 999;

        if (currentTab === 1) { // Próximos a Vencer (0 a 5 días restantes)
            return int_diasMora === 0 && int_daysToExpiry >= 0 && int_daysToExpiry <= 5;
        }
        if (currentTab === 2) { // Vencidos (con mora)
            return int_diasMora > 0;
        }

        return true; // Tab 0: Todos
    });

    // ─── Handlers ───────────────────────────────────────────────────────────────

    /** Abrir modal de creación de suscriptor */
    const handleCreate = () => {
        setModalMode('create');
        setSelectedAdmin(null);
        setUserModalOpen(true);
    };

    /** Abrir modal de edición de suscriptor */
    const handleEdit = (admin) => {
        setModalMode('edit');
        setSelectedAdmin(admin);
        setUserModalOpen(true);
    };

    /** Abrir modal de historial de pagos */
    const handleViewHistory = (admin) => {
        setSelectedAdmin(admin);
        setHistoryModalOpen(true);
    };

    /** Abrir modal de renovación */
    const handleOpenRenewal = (admin) => {
        setSelectedAdmin(admin);
        setRenewalModalOpen(true);
    };

    /** Enviar WhatsApp de cobro al suscriptor moroso */
    const handleWhatsApp = (admin) => {
        const str_phone = admin.movil?.replace(/\D/g, '');
        const str_nombre = admin.nombre?.split(' ')[0] || 'Suscriptor';
        const str_monto = formatCurrency(admin.suscripcion?.monto_mensual || 0);

        const str_message = `Hola ${str_nombre}, le escribimos del Sistema de Créditos.\nLe recordamos que su suscripción ${admin.suscripcion?.tipo_plan || 'mensual'} de ${str_monto} se encuentra vencida.\nPor favor realice el pago para evitar la suspensión del servicio.`;

        const str_url = `https://wa.me/${str_phone}?text=${encodeURIComponent(str_message)}`;
        window.open(str_url, '_blank');
    };

    /** Alternar estado activo/inactivo de un suscriptor */
    const handleToggleStatus = async (admin) => {
        const str_newStatus = admin.estado === 'activo' ? 'inactivo' : 'activo';
        if (!window.confirm(`¿Seguro que deseas ${str_newStatus === 'inactivo' ? 'desactivar' : 'activar'} a ${admin.nombre}?`)) return;

        try {
            const updates = { estado: str_newStatus };

            // Si activamos Y no tiene suscripción válida, inyectamos defaults (Plan Mensual)
            if (str_newStatus === 'activo' && !admin.suscripcion?.id) {
                updates.tipoPlan = 'mensual';
                updates.montoSuscripcion = 50000;
                updates.fechaInicioSuscripcion = new Date().toISOString().split('T')[0];
                // fechaVencimiento se calcula automáticamente en userService si no se envía
            }

            await userService.updateUser(admin.id, updates);
            fetchAdmins();
        } catch (err) {
            console.error('Error toggling status:', err);
            showToast('Error al actualizar estado', 'error');
        }
    };

    /** Crear o editar un suscriptor desde el formulario */
    const handleSubmitUser = async (formData) => {
        try {
            if (modalMode === 'create') {
                await userService.createUser(formData);
            } else {
                await userService.updateUser(selectedAdmin.id, formData);
            }
            setUserModalOpen(false);
            fetchAdmins();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    /** Procesar la renovación de suscripción via API */
    const handleConfirmRenewal = async (renewalData) => {
        if (!selectedAdmin?.id) return;

        try {
            await userService.renewSubscription(selectedAdmin.id, renewalData);
            showToast('Suscripción renovada exitosamente', 'success');
            fetchAdmins();
        } catch (err) {
            console.error('Error renovando suscripción:', err);
            showToast(err.message || 'Error al renovar la suscripción', 'error');
        }
    };

    // ─── Delete Logic ───────────────────────────────────────────────────────────
    const [deleteStep, setDeleteStep] = useState(0); // 0: Closed, 1: Warning, 2: Final
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

    const handleDeleteClick = (admin) => {
        setSelectedAdmin(admin);
        setDeleteStep(1);
    };

    const handleExecuteDelete = async () => {
        if (!selectedAdmin) return;
        try {
            const result = await userService.deleteUser(selectedAdmin.id);
            if (result.success) {
                showToast('Administrador eliminado correctamente.', 'success', 5000);
                setDeleteStep(0);
                setSelectedAdmin(null);
                setDeleteConfirmationText('');
                fetchAdmins();
            }
        } catch (err) {
            console.error('Error deleting user:', err);
            showToast(err.message || 'Error al eliminar usuario', 'error');
            // Mantener modal abierto si hay error (ej. dependencias)
        }
    };

    // ─── Render ─────────────────────────────────────────────────────────────────

    return (
        <Box>
            {/* Título */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold">Gestión de Suscripciones</Typography>
                <Typography variant="body1" color="text.secondary">Administración de licencias y cobros</Typography>
            </Box>

            {/* KPIs */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}><GroupsIcon /></Avatar>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Suscriptores Activos</Typography>
                            <Typography variant="h5" fontWeight="bold">{kpis.totalSuscriptores}</Typography>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'success.light', color: 'success.main' }}><AttachMoneyIcon /></Avatar>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Total Recaudado</Typography>
                            <Typography variant="h5" fontWeight="bold">{formatCurrency(kpis.totalRecaudado)}</Typography>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'error.light', color: 'error.main' }}><ReceiptLongIcon /></Avatar>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Cartera Vencida</Typography>
                            <Typography variant="h5" fontWeight="bold">{formatCurrency(kpis.totalDeuda)}</Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Barra de búsqueda + Toggle vista + Pestañas */}
            <Paper sx={{ mb: 3, borderRadius: '8px', overflow: 'hidden' }}>
                <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Campo de búsqueda */}
                    <TextField
                        placeholder="Buscar suscriptor..."
                        size="small"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                            sx: { borderRadius: '8px' }
                        }}
                        sx={{ flexGrow: 1 }}
                    />

                    {/* Toggle Cards / Tabla */}
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(e, val) => { if (val) setViewMode(val); }}
                        size="small"
                        sx={{ borderRadius: '8px', '& .MuiToggleButton-root': { borderRadius: '8px', px: 1.5 } }}
                    >
                        <ToggleButton value="cards" aria-label="vista cards">
                            <ViewModuleIcon />
                        </ToggleButton>
                        <ToggleButton value="table" aria-label="vista tabla">
                            <ViewListIcon />
                        </ToggleButton>
                    </ToggleButtonGroup>

                    {/* Botón crear suscriptor */}
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} sx={{ borderRadius: '8px' }}>
                        Nuevo Suscriptor
                    </Button>
                </Box>
                {/* Pestañas de filtrado */}
                <Tabs
                    value={currentTab}
                    onChange={(e, val) => setCurrentTab(val)}
                    variant="fullWidth"
                    sx={{ borderTop: 1, borderColor: 'divider' }}
                >
                    <Tab label="Todos" />
                    <Tab label="Próximos a Vencer" />
                    <Tab label="Vencidos" sx={{ color: 'error.main' }} />
                </Tabs>
            </Paper>

            {/* Lista de Suscriptores */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : filteredAdmins.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                    <Typography color="text.secondary">No se encontraron resultados.</Typography>
                </Box>
            ) : viewMode === 'cards' ? (
                /* ─── Vista Cards  ─── */
                <Grid container spacing={2}>
                    {filteredAdmins.map(admin => (
                        <Grid item xs={12} md={6} lg={4} key={admin.id}>
                            <AdminCard
                                admin={admin}
                                onViewHistory={handleViewHistory}
                                onEdit={handleEdit}
                                onToggleStatus={handleToggleStatus}
                                onWhatsApp={handleWhatsApp}
                                onRenew={handleOpenRenewal}
                                onDelete={handleDeleteClick}
                            />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                /* ─── Vista Tabla ─── */
                <Paper sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Suscriptor</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Plan</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Monto</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Vencimiento</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredAdmins.map(admin => {
                                    const sub = admin.suscripcion || {};
                                    const int_diasMora = sub.dias_mora || 0;
                                    const bol_isPending = admin.estado === 'pendiente';
                                    const bol_isActive = admin.estado === 'activo';
                                    const str_plan = sub.tipo_plan || 'mensual';

                                    return (
                                        <TableRow key={admin.id} hover>
                                            {/* Nombre con avatar */}
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Avatar
                                                        src={admin.avatar_url}
                                                        sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: bol_isPending ? 'grey.400' : 'primary.main' }}
                                                    >
                                                        {admin.nombre?.charAt(0)}{admin.apellido?.charAt(0)}
                                                    </Avatar>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {admin.nombre} {admin.apellido}
                                                    </Typography>
                                                </Box>
                                            </TableCell>

                                            {/* Email */}
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">{admin.email}</Typography>
                                            </TableCell>

                                            {/* Plan */}
                                            <TableCell>
                                                <Chip
                                                    label={PLAN_LABELS[str_plan] || str_plan}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ borderRadius: '6px' }}
                                                />
                                            </TableCell>

                                            {/* Monto */}
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {str_plan === 'prueba_gratis' ? 'Gratis' : formatCurrency(sub.monto_mensual)}
                                                </Typography>
                                            </TableCell>

                                            {/* Vencimiento */}
                                            <TableCell>
                                                <Typography
                                                    variant="body2"
                                                    fontWeight="bold"
                                                    color={int_diasMora > 0 ? 'error.main' : 'text.primary'}
                                                >
                                                    {formatDate(sub.fecha_proximo_pago)}
                                                </Typography>
                                                {int_diasMora > 0 && (
                                                    <Typography variant="caption" color="error.main">
                                                        {int_diasMora} días mora
                                                    </Typography>
                                                )}
                                            </TableCell>

                                            {/* Estado */}
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={bol_isPending ? 'Pendiente' : (bol_isActive ? 'Activo' : 'Inactivo')}
                                                    color={bol_isPending ? 'warning' : (bol_isActive ? 'success' : 'default')}
                                                    variant="outlined"
                                                    sx={{ borderRadius: '6px' }}
                                                />
                                            </TableCell>

                                            {/* Acciones */}
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                    <Tooltip title="Historial">
                                                        <IconButton size="small" onClick={() => handleViewHistory(admin)}>
                                                            <ReceiptLongIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Editar">
                                                        <IconButton size="small" onClick={() => handleEdit(admin)}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {!bol_isPending && (
                                                        <Tooltip title="Renovar">
                                                            <IconButton size="small" color="primary" onClick={() => handleOpenRenewal(admin)}>
                                                                <AutorenewIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {!bol_isPending && (
                                                        <Tooltip title={bol_isActive ? 'Desactivar' : 'Activar'}>
                                                            <IconButton
                                                                size="small"
                                                                color={bol_isActive ? 'error' : 'success'}
                                                                onClick={() => handleToggleStatus(admin)}
                                                            >
                                                                {bol_isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Eliminar">
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(admin)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* ─── Modals ──────────────────────────────────────────────────────────── */}

            {/* Modal: Crear/Editar Suscriptor */}
            <UserFormModal
                open={userModalOpen}
                onClose={() => setUserModalOpen(false)}
                onSubmit={handleSubmitUser}
                mode={modalMode}
                userType="admin"
                initialData={selectedAdmin}
            />

            {/* Modal: Historial de Pagos */}
            <PaymentHistoryModal
                open={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                admin={selectedAdmin}
            />

            {/* Modal: Renovar Suscripción */}
            <RenewalModal
                open={renewalModalOpen}
                onClose={() => setRenewalModalOpen(false)}
                onConfirm={handleConfirmRenewal}
                admin={selectedAdmin}
            />

            {/* Modal: Confirmación Paso 1 (Advertencia) */}
            <ConfirmDialog
                open={deleteStep === 1}
                onClose={() => setDeleteStep(0)}
                onConfirm={() => { setDeleteStep(2); setDeleteConfirmationText(''); }}
                title="¿Eliminar Administrador?"
                message={`Estás a punto de iniciar el proceso de eliminación de ${selectedAdmin?.nombre}. El sistema verificará que no tenga datos asociados (clientes, carteras, etc).`}
                confirmText="Continuar"
                severity="warning"
            />

            {/* Modal: Confirmación Paso 2 (Crítica) */}
            <Dialog
                open={deleteStep === 2}
                onClose={() => setDeleteStep(0)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: '12px' } }}
            >
                <DialogTitle component="div" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'error.main', pt: 3 }}>
                    <WarningAmberRoundedIcon sx={{ fontSize: 48 }} />
                    <Typography variant="h6" fontWeight="bold">Confirmación Final</Typography>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" align="center" sx={{ mb: 2, color: 'text.secondary' }}>
                        Esta acción es <b>IRREVERSIBLE</b>. Se eliminará la cuenta de usuario y el acceso al sistema.
                    </Typography>
                    <Typography variant="body2" align="center" sx={{ mb: 2 }}>
                        Escribe <strong>ELIMINAR</strong> abajo para confirmar.
                    </Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="ELIMINAR"
                        value={deleteConfirmationText}
                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                        error={deleteConfirmationText.length > 0 && deleteConfirmationText !== 'ELIMINAR'}
                        autoComplete="off"
                    />
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 3, pt: 0, px: 3 }}>
                    <Button onClick={() => setDeleteStep(0)} variant="outlined" color="inherit" sx={{ borderRadius: '8px', flex: 1 }}>Cancelar</Button>
                    <Button
                        onClick={handleExecuteDelete}
                        variant="contained"
                        color="error"
                        disabled={deleteConfirmationText !== 'ELIMINAR'}
                        sx={{ borderRadius: '8px', flex: 1 }}
                    >
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Suscripciones;
