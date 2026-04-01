import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Button, Grid,
    TextField, InputAdornment, Chip, IconButton,
    CircularProgress, Alert, Tooltip, Divider,
    ToggleButtonGroup, ToggleButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import Inventory2Icon from '@mui/icons-material/Inventory2Rounded';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PersonIcon from '@mui/icons-material/PersonRounded';
import FolderIcon from '@mui/icons-material/FolderRounded';
import GroupsIcon from '@mui/icons-material/GroupsRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';

import CarteraFormModal from '../components/modals/CarteraFormModal';
import CarteraDetalleModal from '../components/modals/CarteraDetalleModal';
import RetiroUtilidadModal from '../components/modals/RetiroUtilidadModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { carteraService } from '../services/carteraService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const CarteraCard = ({ cartera, onEdit, onDelete, onClick, onRetirarUtilidad, isAdmin }) => {
    const hasEncargado = !!cartera.encargado;

    // Formateador de moneda
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);
    
    // Cálculo Utilidad Disponible
    const utilidadDisponible = (cartera.saldo_actual + cartera.saldo_prestado) - cartera.monto_inicial;

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                borderRadius: '16px',
                border: '2px solid',
                // Color diferente si tiene encargado (morado) vs sin encargado (gris)
                borderColor: hasEncargado ? 'secondary.main' : 'divider',
                bgcolor: hasEncargado ? 'rgba(156, 39, 176, 0.02)' : 'background.paper',
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: hasEncargado
                        ? '0 12px 24px -10px rgba(156, 39, 176, 0.2)'
                        : '0 12px 24px -10px rgba(0,0,0,0.1)'
                }
            }}
            onClick={() => onClick(cartera)}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Box sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: hasEncargado ? 'secondary.light' : 'primary.light',
                        color: hasEncargado ? 'secondary.main' : 'primary.main',
                        display: 'flex'
                    }}>
                        <AccountBalanceWalletIcon />
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
                            {cartera.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                            {cartera.codigo}
                        </Typography>
                        {hasEncargado && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <PersonIcon fontSize="inherit" color="secondary" />
                                <Typography variant="caption" color="secondary.main" fontWeight="bold">
                                    Encargado: {cartera.encargado.nombre}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
                <Box>
                    {isAdmin && (
                        <Tooltip title="Archivar cartera">
                            <IconButton size="small" color="default" onClick={(e) => { e.stopPropagation(); onDelete(cartera); }}>
                                <Inventory2Icon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            <Divider sx={{ my: 2 }} flexItem />

            <Grid container spacing={2}>
                <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Saldo Disponible</Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">
                        {formatCurrency(cartera.saldo_actual)}
                    </Typography>
                </Grid>
                <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Prestado</Typography>
                    <Typography variant="h6" fontWeight="bold" color="text.primary">
                        {formatCurrency(cartera.saldo_prestado)}
                    </Typography>
                </Grid>
                {/* Nueva métrica de Utilidad */}
                <Grid item xs={12}>
                    <Box sx={{
                        p: 1.5,
                        borderRadius: '8px',
                        bgcolor: 'secondary.lighter',
                        border: '1px solid',
                        borderColor: 'secondary.light',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUpIcon color="secondary" fontSize="small" />
                            <Typography variant="body2" color="secondary.dark" fontWeight="bold">Utilidad Disponible</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="secondary.main">
                                {formatCurrency(Math.max(0, utilidadDisponible))}
                            </Typography>
                            {isAdmin && utilidadDisponible > 0 && (
                                <Tooltip title="Retirar">
                                    <IconButton 
                                        size="small" 
                                        color="secondary" 
                                        onClick={(e) => { e.stopPropagation(); onRetirarUtilidad(cartera); }}
                                        sx={{ bgcolor: 'secondary.main', color: 'white', '&:hover': { bgcolor: 'secondary.dark' }, ml: 1, width: 28, height: 28 }}
                                    >
                                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>💸</span>
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            {cartera.estado === 'inactivo' && (
                <Chip label="Inactiva" size="small" color="default" sx={{ mt: 2, width: '100%' }} />
            )}
        </Paper>
    );
};

const Carteras = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [carteras, setCarteras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCartera, setSelectedCartera] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('mias'); // 'mias', 'encargos', 'todas'

    // Delete confirmation state
    // Delete confirmation state
    const [deleteDialog, setDeleteDialog] = useState({ open: false, cartera: null, loading: false });
    const [groupBy, setGroupBy] = useState('none'); // none | month | year

    // Detalle Modal State
    const [detalleModalOpen, setDetalleModalOpen] = useState(false);
    const [selectedDetailId, setSelectedDetailId] = useState(null);

    // Retiro Utilidad Modal State
    const [retiroModalOpen, setRetiroModalOpen] = useState(false);
    const [carteraParaRetiro, setCarteraParaRetiro] = useState(null);

    // Detectar rol del usuario
    const isEncargado = user?.rol === 'encargado';
    const isAdmin = user?.rol === 'admin' || user?.rol === 'super_admin';

    const fetchCarteras = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const data = await carteraService.getCarteras();
            setCarteras(data || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchCarteras();
    }, []);

    const handleCreate = () => {
        setSelectedCartera(null);
        setModalOpen(true);
    };

    const handleEdit = (cartera) => {
        // Encargados no pueden editar, solo ver
        if (isEncargado) return;
        setSelectedCartera(cartera);
        setModalOpen(true);
    };

    const handleSubmit = async (formData) => {
        try {
            let result;
            if (selectedCartera) {
                result = await carteraService.updateCartera(selectedCartera.id, formData);
            } else {
                result = await carteraService.createCartera({ ...formData, admin_id: user.id });
            }
            fetchCarteras();
            setModalOpen(false);
            return result; // Retornamos para que el modal pueda asignar encargado
        } catch (err) {
            throw err;
        }
    };

    /**
     * Opens delete confirmation dialog for a cartera.
     */
    const handleDeleteClick = (cartera) => {
        setDeleteDialog({ open: true, cartera, loading: false });
    };

    /**
     * Confirms and executes safe cartera deletion.
     */
    /**
     * Confirms and executes archive action.
     */
    const handleDeleteConfirm = async () => {
        if (!deleteDialog.cartera) return;
        setDeleteDialog(prev => ({ ...prev, loading: true }));
        try {
            const result = await carteraService.archivarCartera(deleteDialog.cartera.id);
            if (result.success) {
                showToast(result.message, 'success');
                fetchCarteras();
            } else {
                showToast(result.message, 'warning');
            }
        } catch (err) {
            showToast('Error al archivar: ' + err.message, 'error');
        } finally {
            setDeleteDialog({ open: false, cartera: null, loading: false });
        }
    };

    const handleCardClick = (cartera) => {
        setSelectedDetailId(cartera.id);
        setDetalleModalOpen(true);
    };

    const handleRetirarUtilidadClick = (cartera) => {
        setCarteraParaRetiro(cartera);
        setRetiroModalOpen(true);
    };

    const handleRetiroSuccess = () => {
        fetchCarteras(false);
    };

    const filtered = carteras.filter(c => {
        // Filtro por búsqueda
        const matchesSearch = c.nombre.toLowerCase().includes(searchTerm.toLowerCase());

        // Excluir archivadas si la lista retorna todo (Asumo que getCarteras retorna todo)
        // Check if we need to filter archvied here or if RPC filters them.
        // Assuming we want to hide archived ones from main list.
        if (c.estado === 'archivada') return false;

        // Encargados solo ven sus carteras asignadas (RLS ya las filtra)
        if (isEncargado) return matchesSearch;

        // Filtros solo para Admins
        if (filterType === 'mias') {
            return matchesSearch && !c.encargado;
        } else if (filterType === 'encargos') {
            return matchesSearch && !!c.encargado;
        }
        return matchesSearch; // 'todas'
    });

    // Helper: Group items by date
    const groupItemsByDate = (items, type) => {
        if (type === 'none') return { 'Todos': items };

        return items.reduce((groups, item) => {
            // Fallback to now if created_at is missing (should not happen but safe)
            const date = new Date(item.created_at || new Date().toISOString());
            let key = 'Sin Fecha';

            if (!isNaN(date.getTime())) {
                if (type === 'month') {
                    const month = date.toLocaleString('es-CO', { month: 'long' });
                    const year = date.getFullYear();
                    key = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
                } else if (type === 'year') {
                    key = date.getFullYear().toString();
                }
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
            return groups;
        }, {});
    };

    const groupedCarteras = groupItemsByDate(filtered, groupBy);
    const sortedGroupKeys = Object.keys(groupedCarteras).sort((a, b) => {
        const yearA = parseInt(a.match(/\d{4}/)?.[0] || 0);
        const yearB = parseInt(b.match(/\d{4}/)?.[0] || 0);
        if (yearA !== yearB) return yearB - yearA;

        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthA = months.find(m => a.includes(m)) || '';
        const monthB = months.find(m => b.includes(m)) || '';
        return months.indexOf(monthB) - months.indexOf(monthA);
    });

    // Contadores (solo para Admins)
    const countMias = carteras.filter(c => !c.encargado).length;
    const countEncargos = carteras.filter(c => !!c.encargado).length;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">
                        {isEncargado ? 'Mis Carteras Asignadas' : 'Carteras'}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {isEncargado
                            ? 'Carteras bajo tu administración'
                            : 'Administra tus fondos y capitales'}
                    </Typography>
                </Box>
                {isAdmin && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleCreate}
                        sx={{ borderRadius: 3, px: 3 }}
                    >
                        Nueva Cartera
                    </Button>
                )}
            </Box>

            {/* Filtros - Solo para Admins */}
            <Paper sx={{ p: 2, borderRadius: '16px', mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                    placeholder="Buscar cartera..."
                    size="small"
                    sx={{ flexGrow: 1, minWidth: 200 }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                        sx: { borderRadius: 3 }
                    }}
                />
                {isAdmin && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                        <ToggleButtonGroup
                            value={filterType}
                            exclusive
                            onChange={(e, v) => v && setFilterType(v)}
                            size="small"
                        >
                            <ToggleButton value="mias" sx={{ borderRadius: '12px 0 0 12px', px: 2 }}>
                                <FolderIcon sx={{ mr: 0.5 }} fontSize="small" />
                                Mis Carteras ({countMias})
                            </ToggleButton>
                            <ToggleButton value="encargos" sx={{ px: 2 }}>
                                <GroupsIcon sx={{ mr: 0.5 }} fontSize="small" />
                                Encargos ({countEncargos})
                            </ToggleButton>
                            <ToggleButton value="todas" sx={{ borderRadius: '0 12px 12px 0', px: 2 }}>
                                Todas
                            </ToggleButton>
                        </ToggleButtonGroup>

                        <ToggleButtonGroup
                            value={groupBy}
                            exclusive
                            onChange={(e, v) => v && setGroupBy(v)}
                            size="small"
                        >
                            <ToggleButton value="none" sx={{ borderRadius: '12px 0 0 12px', px: 2 }}>Sin Filtro</ToggleButton>
                            <ToggleButton value="month" sx={{ px: 2 }}>Mes-Año</ToggleButton>
                            <ToggleButton value="year" sx={{ borderRadius: '0 12px 12px 0', px: 2 }}>Año</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                )}
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
                                <Typography color="text.secondary">
                                    {filterType === 'mias'
                                        ? 'No tienes carteras propias sin encargado.'
                                        : filterType === 'encargos'
                                            ? 'No tienes carteras encargadas a terceros.'
                                            : 'No se encontraron carteras matching.'}
                                </Typography>
                            </Paper>
                        </Grid>
                    ) : groupBy === 'none' ? (
                        /* Flat List */
                        <Grid container spacing={2} sx={{ width: '100%' }}>
                            {filtered.map(cartera => (
                                <Grid item xs={12} sm={6} md={4} key={cartera.id}>
                                    <CarteraCard
                                        cartera={cartera}
                                        onClick={handleCardClick}
                                        onEdit={handleEdit}
                                        onDelete={handleDeleteClick}
                                        onRetirarUtilidad={handleRetirarUtilidadClick}
                                        isAdmin={isAdmin}
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
                                <Grid container spacing={2} sx={{ width: '100%' }}>
                                    {groupedCarteras[key].map(cartera => (
                                        <Grid item xs={12} sm={6} md={4} key={cartera.id}>
                                            <CarteraCard
                                                cartera={cartera}
                                                onClick={handleCardClick}
                                                onEdit={handleEdit}
                                                onDelete={handleDeleteClick}
                                                onRetirarUtilidad={handleRetirarUtilidadClick}
                                                isAdmin={isAdmin}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        ))
                    )}
                </Box>
            )}

            <CarteraFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                mode={selectedCartera ? 'edit' : 'create'}
                initialData={selectedCartera}
            />

            <CarteraDetalleModal
                open={detalleModalOpen}
                onClose={() => setDetalleModalOpen(false)}
                carteraId={selectedDetailId}
                onEdit={handleEdit}
                onRefresh={() => fetchCarteras(false)}
            />

            <RetiroUtilidadModal
                open={retiroModalOpen}
                onClose={() => setRetiroModalOpen(false)}
                cartera={carteraParaRetiro}
                onSuccess={handleRetiroSuccess}
            />

            {/* Archive Confirmation Dialog */}
            <ConfirmDialog
                open={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, cartera: null, loading: false })}
                onConfirm={handleDeleteConfirm}
                title="Archivar Cartera"
                message={`¿Está seguro que desea archivar la cartera "${deleteDialog.cartera?.nombre}"? Esta acción ocultará la cartera de la lista principal. Solo se puede archivar si no tiene créditos activos.`}
                confirmText="Archivar"
                severity="info"
                loading={deleteDialog.loading}
            />
        </Box >
    );
};

export default Carteras;
