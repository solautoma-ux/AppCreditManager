import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    TextField,
    InputAdornment,
    Chip,
    Avatar,
    Divider,
    ToggleButtonGroup,
    ToggleButton,
    CircularProgress,
    Alert,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchRounded';
import AddIcon from '@mui/icons-material/AddRounded';
import VisibilityIcon from '@mui/icons-material/VisibilityRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import BlockIcon from '@mui/icons-material/BlockRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import EmailIcon from '@mui/icons-material/EmailRounded';
import FolderIcon from '@mui/icons-material/FolderRounded';
import GroupIcon from '@mui/icons-material/GroupsRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import UserFormModal from '../components/modals/UserFormModal';
import EncargadoDetalleModal from '../components/modals/EncargadoDetalleModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Tarjeta simplificada para Encargados (vista Admin)
const EncargadoCard = ({ encargado, onView, onEdit, onToggleStatus, onResendInvite, onDelete }) => {
    const isActive = encargado.estado === 'activo';
    const isPending = encargado.estado === 'pendiente';

    return (
        <Paper
            sx={{
                p: 3,
                borderRadius: '16px', // Ajustado a 16px (menos redondo)
                mb: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar
                    src={encargado.avatar_url}
                    sx={{ width: 48, height: 48, bgcolor: isPending ? 'grey.400' : 'secondary.main', fontSize: '1.2rem' }}
                >
                    {encargado.nombre?.charAt(0)}{encargado.apellido?.charAt(0)}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                        {encargado.nombre} {encargado.apellido}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {encargado.email}
                    </Typography>
                </Box>
                <Chip
                    icon={isActive ? <CheckCircleIcon /> : (isPending ? <EmailIcon /> : <BlockIcon />)}
                    label={isActive ? 'Activo' : (isPending ? 'Pendiente' : 'Inactivo')}
                    color={isActive ? 'success' : (isPending ? 'warning' : 'default')}
                    size="small"
                />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FolderIcon fontSize="small" color="secondary" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Carteras Asignadas</Typography>
                            <Typography variant="subtitle2" fontWeight="bold">{encargado.carteras_count || 0}</Typography>
                        </Box>
                    </Box>
                </Grid>
                <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GroupIcon fontSize="small" color="secondary" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Cédula</Typography>
                            <Typography variant="subtitle2" fontWeight="bold">{encargado.cedula || 'No reg.'}</Typography>
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => onView(encargado)} sx={{ borderRadius: 2 }}>
                    Detalle
                </Button>
                <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => onEdit(encargado)} sx={{ borderRadius: 2 }}>
                    Editar
                </Button>
                {isPending && (
                    <Button size="small" variant="outlined" color="primary" startIcon={<EmailIcon />} onClick={() => onResendInvite(encargado)} sx={{ borderRadius: 2 }}>
                        Reenviar
                    </Button>
                )}
                {!isPending && (
                    <Button
                        size="small"
                        variant={isActive ? 'outlined' : 'contained'}
                        color={isActive ? 'error' : 'success'}
                        startIcon={isActive ? <BlockIcon /> : <CheckCircleIcon />}
                        onClick={() => onToggleStatus(encargado)}
                        sx={{ borderRadius: 2 }}
                    >
                        {isActive ? 'Inhabilitar' : 'Habilitar'}
                    </Button>
                )}
                {/* Botón Eliminar */}
                <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => onDelete(encargado)}
                    sx={{ borderRadius: 2, ml: 'auto' }}
                >
                    Eliminar
                </Button>
            </Box>
        </Paper>
    );
};

const Encargados = () => {
    const { user } = useAuth();
    const [encargados, setEncargados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('todos');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEncargado, setSelectedEncargado] = useState(null);
    const { showToast } = useToast();

    // Delete Logic
    const [deleteStep, setDeleteStep] = useState(0); // 0: Closed, 1: Warning, 2: Final
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [encargadoToDelete, setEncargadoToDelete] = useState(null);

    const fetchEncargados = async () => {
        setLoading(true);
        try {
            // RLS se encargará de mostrar solo los del Admin actual
            const data = await userService.getUsers('encargado');
            setEncargados(data || []);
            setError(null);
        } catch (err) {
            setError('Error al cargar encargados');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEncargados();
    }, []);

    const filteredEncargados = encargados.filter(e => {
        const matchesSearch =
            (e.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'todos' || e.estado === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const handleInvite = () => {
        setSelectedEncargado(null);
        setModalOpen(true);
    };

    const handleEdit = (e) => {
        setSelectedEncargado(e);
        setModalOpen(true);
    };

    const handleDeleteClick = (encargado) => {
        setEncargadoToDelete(encargado);
        setDeleteStep(1);
    };

    const handleExecuteDelete = async () => {
        if (!encargadoToDelete) return;
        try {
            const result = await userService.deleteUser(encargadoToDelete.id);
            if (result.success) {
                showToast('Encargado eliminado correctamente', 'success', 5000);
                setDeleteStep(0);
                setEncargadoToDelete(null);
                setDeleteConfirmationText('');
                fetchEncargados();
            }
        } catch (err) {
            console.error('Error deleting user:', err);
            showToast(err.message || 'Error al eliminar encargado', 'error');
            // Keep modal open on error to show logic feedback
        }
    };

    const handleSubmit = async (formData) => {
        try {
            if (selectedEncargado) {
                await userService.updateUser(selectedEncargado.id, formData);
                showToast('Encargado actualizado', 'success');
            } else {
                await userService.createUser(formData, user.id);
                showToast('Invitación enviada', 'success');
            }
            setModalOpen(false);
            fetchEncargados();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // State for toggle status confirmation
    const [toggleDialog, setToggleDialog] = useState({ open: false, encargado: null, loading: false });

    const handleToggleStatus = (encargado) => {
        setToggleDialog({ open: true, encargado, loading: false });
    };

    const handleToggleStatusConfirm = async () => {
        if (!toggleDialog.encargado) return;
        setToggleDialog(prev => ({ ...prev, loading: true }));
        const encargado = toggleDialog.encargado;
        const newStatus = encargado.estado === 'activo' ? 'inactivo' : 'activo';
        const action = newStatus === 'activo' ? 'habilitado' : 'inhabilitado';
        try {
            await userService.updateUser(encargado.id, { estado: newStatus });
            showToast(`Encargado ${action} correctamente`, 'success');
            fetchEncargados();
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error');
        } finally {
            setToggleDialog({ open: false, encargado: null, loading: false });
        }
    };

    const handleResendInvite = (e) => showToast('Reenviando invitación a ' + e.email, 'info');

    // Estado para modal de detalle
    const [detalleModal, setDetalleModal] = useState({ open: false, encargado: null });
    const handleViewDetail = (encargado) => setDetalleModal({ open: true, encargado });
    const handleCloseDetalle = () => setDetalleModal({ open: false, encargado: null });

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">Encargados</Typography>
                    <Typography variant="body1" color="text.secondary">Gestiona tu equipo de trabajo en campo</Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleInvite} sx={{ borderRadius: 3, px: 3 }}>
                    Invitar Encargado
                </Button>
            </Box>

            <Paper sx={{ p: 2, borderRadius: 4, mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    placeholder="Buscar encargado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    sx={{ flexGrow: 1 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>, sx: { borderRadius: 3 } }}
                />
                <ToggleButtonGroup value={filterStatus} exclusive onChange={(e, v) => v && setFilterStatus(v)} size="small">
                    <ToggleButton value="todos" sx={{ borderRadius: '12px 0 0 12px', px: 2 }}>Todos</ToggleButton>
                    <ToggleButton value="activo" sx={{ px: 2 }}>Activos</ToggleButton>
                    <ToggleButton value="pendiente" sx={{ borderRadius: '0 12px 12px 0', px: 2 }}>Pendientes</ToggleButton>
                </ToggleButtonGroup>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : filteredEncargados.length > 0 ? (
                <Grid container spacing={2} sx={{ width: '100%' }}>
                    {filteredEncargados.map(e => (
                        <Grid item xs={12} key={e.id}>
                            <EncargadoCard
                                encargado={e}
                                onEdit={handleEdit}
                                onToggleStatus={handleToggleStatus}
                                onResendInvite={handleResendInvite}
                                onView={handleViewDetail}
                                onDelete={handleDeleteClick}
                            />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Paper sx={{ p: 6, borderRadius: '16px', textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">No tienes encargados aún</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleInvite} sx={{ mt: 2 }}>Invitar Encargado</Button>
                </Paper>
            )}

            <UserFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                mode={selectedEncargado ? 'edit' : 'create'}
                userType="encargado"
                initialData={selectedEncargado}
            />

            {/* Modal: Confirmación Paso 1 (Advertencia) */}
            <ConfirmDialog
                open={deleteStep === 1}
                onClose={() => { setDeleteStep(0); setEncargadoToDelete(null); }}
                onConfirm={() => { setDeleteStep(2); setDeleteConfirmationText(''); }}
                title="¿Eliminar Encargado?"
                message={`Estás a punto de iniciar el proceso de eliminación de ${encargadoToDelete?.nombre}. El sistema verificará que no tenga datos asociados (créditos, pagos, carteras).`}
                confirmText="Continuar"
                severity="warning"
            />

            {/* Modal: Confirmación Paso 2 (Crítica) */}
            <Dialog
                open={deleteStep === 2}
                onClose={() => { setDeleteStep(0); setEncargadoToDelete(null); }}
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
                        Esta acción es <b>IRREVERSIBLE</b>. Se eliminará la cuenta del encargado y perderá acceso total.
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
                    <Button onClick={() => { setDeleteStep(0); setEncargadoToDelete(null); }} variant="outlined" color="inherit" sx={{ borderRadius: '8px', flex: 1 }}>Cancelar</Button>
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

            {/* Toggle Status Confirmation Dialog */}
            <ConfirmDialog
                open={toggleDialog.open}
                onClose={() => setToggleDialog({ open: false, encargado: null, loading: false })}
                onConfirm={handleToggleStatusConfirm}
                title={toggleDialog.encargado?.estado === 'activo' ? 'Inhabilitar Encargado' : 'Habilitar Encargado'}
                message={
                    toggleDialog.encargado?.estado === 'activo'
                        ? `¿Estás seguro de inhabilitar a ${toggleDialog.encargado?.nombre}? Perderá acceso al sistema inmediatamente.`
                        : `¿Deseas habilitar nuevamente a ${toggleDialog.encargado?.nombre}?`
                }
                confirmText={toggleDialog.encargado?.estado === 'activo' ? 'Inhabilitar' : 'Habilitar'}
                severity={toggleDialog.encargado?.estado === 'activo' ? 'warning' : 'success'}
                loading={toggleDialog.loading}
            />

            {/* Modal de Detalle de Encargado */}
            <EncargadoDetalleModal
                open={detalleModal.open}
                onClose={handleCloseDetalle}
                encargado={detalleModal.encargado}
            />
        </Box>
    );
};

export default Encargados;
