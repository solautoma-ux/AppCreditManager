import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, IconButton,
    InputAdornment, Divider, Alert, Autocomplete, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/PersonRounded';
import { userService } from '../../services/userService';
import { carteraService } from '../../services/carteraService';
import { useAuth } from '../../context/AuthContext';

const CarteraFormModal = ({ open, onClose, onSubmit, mode = 'create', initialData = null }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        nombre: '',
        monto_inicial: '',
        codigo: '',
        estado: 'activa',
        encargado_id: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [encargados, setEncargados] = useState([]);
    const [currentAssignment, setCurrentAssignment] = useState(null);

    // Determinar si la cartera está sin usar (para habilitar asignación de encargado)
    const isCarteraUnused = mode === 'create' ||
        (initialData && initialData.saldo_actual === initialData.monto_inicial);

    // Cargar datos al abrir
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && initialData) {
                setFormData({
                    nombre: initialData.nombre || '',
                    monto_inicial: initialData.monto_inicial || '',
                    codigo: initialData.codigo || '',
                    estado: initialData.estado || 'activa',
                    encargado_id: ''
                });
                // Cargar encargado actual si existe
                loadCurrentAssignment(initialData.id);
            } else {
                setFormData({
                    nombre: '',
                    monto_inicial: '',
                    codigo: generateCode(),
                    estado: 'activa',
                    encargado_id: ''
                });
                setCurrentAssignment(null);
            }
            setErrors({});
            loadEncargados();
        }
    }, [open, mode, initialData]);

    const generateCode = () => {
        return 'CART-' + Math.floor(1000 + Math.random() * 9000);
    };

    const loadEncargados = async () => {
        try {
            const data = await userService.getUsers('encargado');
            setEncargados(data || []);
        } catch (err) {
            console.error('Error loading encargados:', err);
        }
    };

    const loadCurrentAssignment = async (carteraId) => {
        try {
            const assignment = await carteraService.getCarteraEncargado(carteraId);
            if (assignment?.encargado) {
                setCurrentAssignment(assignment.encargado);
                setFormData(prev => ({ ...prev, encargado_id: assignment.encargado.id }));
            }
        } catch (err) {
            console.error('Error loading assignment:', err);
        }
    };

    const handleChange = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
        if (errors[field]) setErrors({ ...errors, [field]: null });
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido';

        if (mode === 'create') {
            if (!formData.monto_inicial) newErrors.monto_inicial = 'Monto inicial requerido';
            else if (Number(formData.monto_inicial) < 0) newErrors.monto_inicial = 'El monto no puede ser negativo';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            // Guardar cartera
            const result = await onSubmit({
                ...formData,
                encargado_id: undefined // No enviamos esto a la tabla carteras
            });

            // Si hay encargado seleccionado y la cartera se creó exitosamente, asignar
            if (formData.encargado_id && result?.data?.id) {
                await carteraService.assignEncargado(
                    result.data.id,
                    formData.encargado_id,
                    user.id
                );
            } else if (mode === 'edit' && initialData?.id && isCarteraUnused) {
                // En edición, manejar cambio/remoción de encargado
                if (formData.encargado_id) {
                    await carteraService.assignEncargado(
                        initialData.id,
                        formData.encargado_id,
                        user.id
                    );
                } else if (currentAssignment) {
                    // Si había encargado y ahora no hay, remover
                    await carteraService.removeEncargado(initialData.id);
                }
            }

            onClose();
        } catch (err) {
            setErrors({ submit: err.message || 'Error al guardar' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: '16px' } }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountBalanceWalletIcon color="primary" />
                    {mode === 'create' ? 'Nueva Cartera' : 'Editar Cartera'}
                </Typography>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 3 }}>
                {errors.submit && <Alert severity="error" sx={{ mb: 2 }}>{errors.submit}</Alert>}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField
                        label="Nombre de la Cartera"
                        placeholder="Ej: Inversión Propia"
                        fullWidth
                        required
                        value={formData.nombre}
                        onChange={handleChange('nombre')}
                        error={!!errors.nombre}
                        helperText={errors.nombre}
                        InputProps={{ sx: { borderRadius: 3 } }}
                    />

                    {mode === 'create' && (
                        <Box>
                            <TextField
                                label="Monto Inicial (Capital)"
                                fullWidth
                                required
                                type="number"
                                value={formData.monto_inicial}
                                onChange={handleChange('monto_inicial')}
                                error={!!errors.monto_inicial}
                                helperText={errors.monto_inicial}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                    sx: { borderRadius: 3 }
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                                <InfoIcon fontSize="inherit" />
                                Este será el saldo disponible para iniciar.
                            </Typography>
                        </Box>
                    )}

                    <TextField
                        label="Código Interno"
                        value={formData.codigo}
                        disabled
                        fullWidth
                        InputProps={{
                            sx: { borderRadius: 3, bgcolor: 'action.hover' }
                        }}
                        helperText="Generado automáticamente"
                    />

                    {/* Selector de Encargado (Opcional) */}
                    <Box>
                        <Autocomplete
                            options={encargados}
                            getOptionLabel={(option) => `${option.nombre} ${option.apellido}`}
                            value={encargados.find(e => e.id === formData.encargado_id) || null}
                            onChange={(event, newValue) => {
                                setFormData({ ...formData, encargado_id: newValue?.id || '' });
                            }}
                            disabled={!isCarteraUnused}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Encargado (Opcional)"
                                    placeholder={isCarteraUnused ? "Seleccionar encargado..." : "No modificable - Cartera usada"}
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <>
                                                <PersonIcon color="action" sx={{ ml: 1, mr: 0.5 }} />
                                                {params.InputProps.startAdornment}
                                            </>
                                        ),
                                        sx: { borderRadius: 3 }
                                    }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            noOptionsText="No hay encargados disponibles"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                            <InfoIcon fontSize="inherit" />
                            {isCarteraUnused
                                ? 'Asigna un encargado para administrar esta cartera (solo antes del primer préstamo).'
                                : 'No se puede cambiar el encargado después de iniciar préstamos.'}
                        </Typography>
                    </Box>

                    {mode === 'edit' && (
                        <TextField
                            select
                            label="Estado"
                            value={formData.estado}
                            onChange={handleChange('estado')}
                            SelectProps={{ native: true }}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            InputProps={{ sx: { borderRadius: 3 } }}
                        >
                            <option value="activa">Activa</option>
                            <option value="inactiva">Inactiva</option>
                        </TextField>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
                <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 3 }}>Cancelar</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={isSubmitting}
                    sx={{ borderRadius: 3, px: 4 }}
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar Cartera'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CarteraFormModal;
