import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Grid,
    TextField, InputAdornment, Chip, IconButton, Tooltip,
    CircularProgress, Alert, Avatar, ToggleButtonGroup, ToggleButton,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import PhoneIcon from '@mui/icons-material/PhoneRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import LocationOnIcon from '@mui/icons-material/LocationOnRounded';
import CreditCardIcon from '@mui/icons-material/CreditCardRounded';
import GridViewIcon from '@mui/icons-material/GridViewRounded';
import ViewListIcon from '@mui/icons-material/ViewListRounded';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import ArchiveIcon from '@mui/icons-material/ArchiveRounded';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrashRounded';
import PersonIcon from '@mui/icons-material/PersonRounded';
import Inventory2Icon from '@mui/icons-material/Inventory2Rounded';
import AllInclusiveIcon from '@mui/icons-material/AllInclusiveRounded';
import { whatsappService } from '../services/whatsappService';

import ConfirmDialog from '../components/common/ConfirmDialog';
import ClienteFormModal from '../components/modals/ClienteFormModal';
import ClienteDetalleModal from '../components/modals/ClienteDetalleModal';
import { clienteService } from '../services/clienteService';
import { useAuth } from '../context/AuthContext';

const ClienteCard = ({ cliente, onEdit, onViewLoans, onArchive, onActivate }) => {
    const scoreColor = {
        'verde': 'success',
        'amarillo': 'warning',
        'rojo': 'error'
    }[cliente.calificacion_color] || 'default';

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)'
                }
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
                        {cliente.nombre.charAt(0)}{cliente.apellido.charAt(0)}
                    </Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
                            {cliente.nombre} {cliente.apellido}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            C.C. {cliente.cedula}
                        </Typography>
                    </Box>
                </Box>
                <Chip
                    label={`Score ${cliente.calificacion_score ?? 100}`}
                    size="small"
                    color={scoreColor}
                    variant={scoreColor === 'default' ? 'outlined' : 'filled'}
                    sx={{ fontWeight: 'bold' }}
                />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.9rem' }}>
                    <PhoneIcon fontSize="small" />
                    {cliente.movil}
                    {/* WhatsApp Link - opens empty chat so user can type their own message */}
                    <IconButton size="small" color="success" onClick={() => whatsappService.sendTo(cliente.movil, '')}>
                        <WhatsAppIcon fontSize="inherit" />
                    </IconButton>
                </Box>
                {cliente.direccion && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.9rem' }}>
                        <LocationOnIcon fontSize="small" />
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {cliente.direccion}
                        </Typography>
                    </Box>
                )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CreditCardIcon />}
                    sx={{ borderRadius: 2, flexGrow: 1 }}
                    onClick={() => onViewLoans(cliente)}
                >
                    Préstamos ({cliente.prestamos_activos ?? 0})
                </Button>
                <IconButton
                    size="small"
                    onClick={() => onEdit(cliente)}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                >
                    <EditIcon fontSize="small" />
                </IconButton>
                <Tooltip title={cliente.estado === 'inactivo' ? "Activar Cliente" : "Archivar Cliente"}>
                    <IconButton
                        size="small"
                        color={cliente.estado === 'inactivo' ? "success" : "error"}
                        onClick={() => cliente.estado === 'inactivo' ? onActivate(cliente) : onArchive(cliente)}
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            bgcolor: cliente.estado === 'inactivo' ? 'success.lighter' : 'error.lighter',
                            color: cliente.estado === 'inactivo' ? 'success.main' : 'error.main'
                        }}
                    >
                        {cliente.estado === 'inactivo' ? <RestoreFromTrashIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </Box>
        </Paper>
    );
};

const Clientes = () => {
    const { user } = useAuth();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [detalleModalOpen, setDetalleModalOpen] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState(null);
    const [selectedDetailCliente, setSelectedDetailCliente] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
    const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, client: null }); // type: 'archive' | 'activate'
    const [filterStatus, setFilterStatus] = useState('active'); // 'active', 'archived', 'all'

    const fetchClientes = async () => {
        setLoading(true);
        try {
            const data = await clienteService.getClientes();
            setClientes(data || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClientes();
    }, []);

    const handleCreate = () => {
        setSelectedCliente(null);
        setModalOpen(true);
    };

    const handleEdit = (cliente) => {
        setSelectedCliente(cliente);
        setModalOpen(true);
    };

    const handleSubmit = async (formData) => {
        try {
            if (selectedCliente) {
                await clienteService.updateCliente(selectedCliente.id, formData);
            } else {
                // Determinar admin_id y creado_por_id según el rol
                // Encargados: admin_id es el admin que los creó (guardado en admin_padre_id)
                // Admins: admin_id es su propio ID
                const adminId = user.rol === 'encargado' ? user.admin_padre_id : user.id;
                const creadoPorId = user.id; // Siempre el usuario actual

                await clienteService.createCliente(formData, adminId, creadoPorId);
            }
            fetchClientes();
            setModalOpen(false);
        } catch (err) {
            throw err; // El modal maneja el error
        }
    };

    const filtered = clientes.filter(c => {
        const matchesSearch = c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.cedula.includes(searchTerm);

        if (filterStatus === 'all') return matchesSearch;
        if (filterStatus === 'archived') return matchesSearch && c.estado === 'inactivo';
        return matchesSearch && c.estado !== 'inactivo'; // default 'active'
    });

    // Sorted list for table view
    const sortedFiltered = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const nameA = `${a.nombre} ${a.apellido}`.toLowerCase();
            const nameB = `${b.nombre} ${b.apellido}`.toLowerCase();
            if (sortOrder === 'asc') {
                return nameA.localeCompare(nameB);
            } else {
                return nameB.localeCompare(nameA);
            }
        });
    }, [filtered, sortOrder]);

    const handleLinkExisting = async (cliente) => {
        try {
            await clienteService.linkClienteToEncargado(cliente.id, user.id);
            fetchClientes(); // Refresh list to show the newly linked client
            setModalOpen(false);
        } catch (err) {
            throw err; // Modal handles display
        }
    };

    const handleStatusClick = (cliente, type) => {
        setConfirmDialog({ open: true, type, client: cliente });
    };

    const [errorDialog, setErrorDialog] = useState({ open: false, message: '' });

    const handleConfirmStatusChange = async () => {
        const { client, type } = confirmDialog;
        if (!client) return;

        try {
            if (type === 'archive') {
                await clienteService.archivarCliente(client.id);
                // Update local state: set to inactive
                setClientes(prev => prev.map(c => c.id === client.id ? { ...c, estado: 'inactivo' } : c));
            } else {
                await clienteService.activarCliente(client.id);
                // Update local state: set to active
                setClientes(prev => prev.map(c => c.id === client.id ? { ...c, estado: 'activo' } : c));
            }
            setConfirmDialog({ open: false, type: null, client: null });
        } catch (err) {
            console.error(`Error ${type}ing client:`, err);
            // Mostrar modal de error en lugar de alert
            setConfirmDialog({ open: false, type: null, client: null }); // Cerrar el de confirmación
            setErrorDialog({
                open: true,
                message: err.message || `Error al ${type === 'archive' ? 'archivar' : 'activar'} cliente`
            });
        }
    };

    // Counts for tabs
    const countActive = clientes.filter(c => c.estado !== 'inactivo').length;
    const countArchived = clientes.filter(c => c.estado === 'inactivo').length;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">
                        {filterStatus === 'archived' ? 'Clientes Archivados' : 'Clientes'}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {filterStatus === 'archived' ? 'Historial de clientes inactivos' : 'Gestiona tu cartera de clientes'}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreate}
                    sx={{ borderRadius: 3, px: 3 }}
                >
                    Nuevo Cliente
                </Button>
            </Box>

            {/* Filtros */}
            <Paper sx={{ p: 2, borderRadius: '16px', mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    placeholder="Buscar por nombre, apellido o cédula..."
                    size="small"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                        sx: { borderRadius: 3, border: 'none' }
                    }}
                    sx={{ '& fieldset': { border: 'none' }, flexGrow: 1, minWidth: 200 }}
                />
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ToggleButtonGroup
                        value={filterStatus}
                        exclusive
                        onChange={(e, v) => v && setFilterStatus(v)}
                        size="small"
                    >
                        <ToggleButton value="active" sx={{ borderRadius: '12px 0 0 12px', px: 2 }}>
                            <PersonIcon sx={{ mr: 0.5 }} fontSize="small" />
                            Activos ({countActive})
                        </ToggleButton>
                        <ToggleButton value="archived" sx={{ px: 2 }}>
                            <Inventory2Icon sx={{ mr: 0.5 }} fontSize="small" />
                            Archivados ({countArchived})
                        </ToggleButton>
                        <ToggleButton value="all" sx={{ borderRadius: '0 12px 12px 0', px: 2 }}>
                            <AllInclusiveIcon sx={{ mr: 0.5 }} fontSize="small" />
                            Todos
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(e, val) => val && setViewMode(val)}
                        size="small"
                    >
                        <ToggleButton value="grid"><GridViewIcon /></ToggleButton>
                        <ToggleButton value="table"><ViewListIcon /></ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : viewMode === 'table' ? (
                /* TABLE VIEW */
                <TableContainer component={Paper} sx={{ borderRadius: '16px' }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell
                                    sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        Cliente
                                        {sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Cédula</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Móvil</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Dirección</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Score</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Préstamos</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedFiltered.map((cliente) => {
                                const scoreColor = {
                                    'verde': 'success',
                                    'amarillo': 'warning',
                                    'rojo': 'error'
                                }[cliente.calificacion_color] || 'default';
                                return (
                                    <TableRow key={cliente.id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32, fontSize: '0.8rem' }}>
                                                    {cliente.nombre.charAt(0)}{cliente.apellido.charAt(0)}
                                                </Avatar>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {cliente.nombre} {cliente.apellido}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>{cliente.cedula}</TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {cliente.movil}
                                                <Tooltip title="WhatsApp">
                                                    <IconButton size="small" color="success" onClick={() => whatsappService.sendTo(cliente.movil, '')}>
                                                        <WhatsAppIcon fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                                {cliente.direccion || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={cliente.calificacion_score ?? 100}
                                                size="small"
                                                color={scoreColor}
                                                variant={scoreColor === 'default' ? 'outlined' : 'filled'}
                                                sx={{ fontWeight: 'bold', minWidth: 40 }}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={cliente.prestamos_activos ?? 0}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                                <Tooltip title="Ver Préstamos">
                                                    <IconButton size="small" color="primary" onClick={() => {
                                                        setSelectedDetailCliente(cliente);
                                                        setDetalleModalOpen(true);
                                                    }}>
                                                        <CreditCardIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Editar">
                                                    <IconButton size="small" color="default" onClick={() => handleEdit(cliente)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={cliente.estado === 'inactivo' ? "Activar" : "Archivar"}>
                                                    <IconButton
                                                        size="small"
                                                        color={cliente.estado === 'inactivo' ? "success" : "error"}
                                                        onClick={() => handleStatusClick(cliente, cliente.estado === 'inactivo' ? 'activate' : 'archive')}
                                                    >
                                                        {cliente.estado === 'inactivo' ? <RestoreFromTrashIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {sortedFiltered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">No se encontraron clientes.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                /* GRID VIEW (original cards) */
                <Grid container spacing={2} sx={{ width: '100%', justifyContent: 'flex-start' }}>
                    {filtered.map(cliente => (
                        <Grid item xs={12} sm={6} md={4} key={cliente.id}>
                            <ClienteCard
                                cliente={cliente}
                                onEdit={handleEdit}
                                onViewLoans={(c) => {
                                    setSelectedDetailCliente(c);
                                    setDetalleModalOpen(true);
                                }}
                                onArchive={() => handleStatusClick(cliente, 'archive')}
                                onActivate={() => handleStatusClick(cliente, 'activate')}
                            />
                        </Grid>
                    ))}
                    {filtered.length === 0 && (
                        <Grid item xs={12}>
                            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: '16px' }}>
                                <Typography color="text.secondary">No se encontraron clientes.</Typography>
                                <Button sx={{ mt: 2 }} onClick={handleCreate}>Crear el primero</Button>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            )}

            <ClienteFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                onLinkExisting={handleLinkExisting}
                mode={selectedCliente ? 'edit' : 'create'}
                initialData={selectedCliente}
            />

            <ClienteDetalleModal
                open={detalleModalOpen}
                onClose={() => setDetalleModalOpen(false)}
                cliente={selectedDetailCliente}
            />

            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.type === 'archive' ? "¿Archivar Cliente?" : "¿Activar Cliente?"}
                content={confirmDialog.type === 'archive'
                    ? `¿Estás seguro de archivar a ${confirmDialog.client?.nombre}? Pasará a estado Inactivo.`
                    : `¿Estás seguro de reactivar a ${confirmDialog.client?.nombre}? Volverá a la lista principal.`}
                onConfirm={handleConfirmStatusChange}
                onClose={() => setConfirmDialog({ open: false, type: null, client: null })}
                severity={confirmDialog.type === 'archive' ? 'warning' : 'success'}
                confirmText={confirmDialog.type === 'archive' ? 'Archivar' : 'Activar'}
            />

            {/* Modal de Error */}
            <ConfirmDialog
                open={errorDialog.open}
                title="Acción Bloqueada"
                message={errorDialog.message}
                severity="error"
                confirmText="Entendido"
                cancelText="" // Ocultar botón cancelar
                onConfirm={() => setErrorDialog({ ...errorDialog, open: false })}
                onClose={() => setErrorDialog({ ...errorDialog, open: false })}
            />
        </Box>
    );
};

export default Clientes;
