import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, IconButton,
    Grid, Divider, Alert, InputAdornment, Select, MenuItem,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import PersonIcon from '@mui/icons-material/PersonRounded';
import PhoneIcon from '@mui/icons-material/PhoneRounded';
import HomeIcon from '@mui/icons-material/HomeRounded';
import BadgeIcon from '@mui/icons-material/BadgeRounded';
import EmailIcon from '@mui/icons-material/EmailRounded';
import NoteIcon from '@mui/icons-material/NoteRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import WarningIcon from '@mui/icons-material/WarningAmberRounded';
import LinkIcon from '@mui/icons-material/LinkRounded';

import { clienteService } from '../../services/clienteService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// Common country codes for WhatsApp
const COUNTRY_CODES = [
    { code: '+57', country: 'Colombia' },
    { code: '+58', country: 'Venezuela' },
    { code: '+51', country: 'Perú' },
    { code: '+593', country: 'Ecuador' },
    { code: '+52', country: 'México' },
    { code: '+1', country: 'USA/Can' },
    { code: '+34', country: 'España' },
];

/**
 * Helper function to convert string to Title Case.
 * @param {string} str - Input string
 * @returns {string} - Title cased string
 */
const toTitleCase = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const ClienteFormModal = ({ open, onClose, onSubmit, onLinkExisting, mode = 'create', initialData = null }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    // Improved role and parent ID detection
    const isEncargado = user?.rol === 'encargado';
    const isOwner = user?.rol === 'admin' || user?.rol === 'super_admin';

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        cedula: '',
        countryCode: '+57',
        movil: '',
        email: '',
        direccion: '',
        notas: '',
        estado: 'activo'
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cedulaCheck, setCedulaCheck] = useState({ checking: false, exists: false, cliente: null });

    useEffect(() => {
        if (open) {
            if (mode === 'edit' && initialData) {
                // Extract country code if present
                let countryCode = '+57';
                let movil = initialData.movil || '';

                // Try to parse existing phone for country code
                const match = movil.match(/^(\+\d{1,3})\s?(.*)$/);
                if (match) {
                    countryCode = match[1];
                    movil = match[2];
                }

                setFormData({
                    nombre: initialData.nombre || '',
                    apellido: initialData.apellido || '',
                    cedula: initialData.cedula || '',
                    countryCode,
                    movil,
                    email: initialData.email || '',
                    direccion: initialData.direccion || '',
                    notas: initialData.notas || '',
                    estado: initialData.estado || 'activo'
                });
            } else {
                setFormData({
                    nombre: '',
                    apellido: '',
                    cedula: '',
                    countryCode: '+57',
                    movil: '',
                    email: '',
                    direccion: '',
                    notas: '',
                    estado: 'activo'
                });
            }
            setErrors({});
            setCedulaCheck({ checking: false, exists: false, cliente: null });
        }
    }, [open, mode, initialData]);

    const handleChange = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
        if (errors[field]) setErrors({ ...errors, [field]: null });
    };

    /**
     * Formats name fields to Title Case on blur.
     */
    const handleNameBlur = (field) => () => {
        setFormData({ ...formData, [field]: toTitleCase(formData[field]) });
    };

    /**
     * Validates cedula for duplicates on blur.
     */
    const handleCedulaBlur = async () => {
        if (!formData.cedula.trim() || mode === 'edit') return;

        setCedulaCheck({ checking: true, exists: false, cliente: null });
        try {
            // Determine admin_id based on user role (Encargado use admin_padre_id)
            // We search for several potential field names just in case
            const adminId = user.rol === 'admin' ? user.id : (user.admin_padre_id || user.admin_id || user.parent_id);

            console.log('[DEBUG] Checking duplicate for adminId:', adminId, 'Role:', user.rol);

            const result = await clienteService.checkCedulaExists(formData.cedula, adminId);

            console.log('[DEBUG] Duplicate result:', result);

            setCedulaCheck({ checking: false, ...result });

            if (result.exists) {
                setErrors({ ...errors, cedula: `Ya existe: ${result.cliente.nombre} ${result.cliente.apellido}` });
            }
        } catch (err) {
            setCedulaCheck({ checking: false, exists: false, cliente: null });
            console.error('[ERROR] Checking cedula:', err);
        }
    };

    /**
     * Handles linking an existing client to the Encargado's visible list.
     */
    const handleLinkExistingClient = async () => {
        if (!cedulaCheck.cliente || !onLinkExisting) return;
        try {
            await onLinkExisting(cedulaCheck.cliente);
            showToast(`Cliente "${cedulaCheck.cliente.nombre}" vinculado a tu lista.`, 'success');
            onClose();
        } catch (err) {
            showToast('Error al vincular cliente', 'error');
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nombre.trim()) newErrors.nombre = 'Requerido';
        if (!formData.apellido.trim()) newErrors.apellido = 'Requerido';
        if (!formData.cedula.trim()) newErrors.cedula = 'Requerido';
        if (!formData.movil.trim()) newErrors.movil = 'Requerido';
        if (!formData.email.trim()) newErrors.email = 'Email es obligatorio';

        // Validate email format if provided
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Formato de email inválido';
        }

        // Block if cedula already exists
        if (cedulaCheck.exists && mode === 'create') {
            newErrors.cedula = 'Este cliente ya existe en el sistema';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            // Combine country code and phone number
            const fullPhone = `${formData.countryCode} ${formData.movil}`;
            const dataToSubmit = {
                ...formData,
                movil: fullPhone
            };
            delete dataToSubmit.countryCode; // Remove helper field

            await onSubmit(dataToSubmit);
            showToast('Cliente guardado exitosamente', 'success');
            onClose();
        } catch (err) {
            showToast(err.message || 'Error al guardar cliente', 'error');
            setErrors({ submit: err.message || 'Error al guardar' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: '16px' } }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="primary" />
                    {mode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
                </Typography>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 3 }}>
                {errors.submit && <Alert severity="error" sx={{ mb: 2 }}>{errors.submit}</Alert>}

                {/* Encargado Duplicate Found - Link Option */}
                {/* Encargado Duplicate Found - Link Option */}
                {cedulaCheck.exists && onLinkExisting && (
                    <Alert
                        severity="info"
                        sx={{ mb: 2 }}
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                startIcon={<LinkIcon />}
                                onClick={handleLinkExistingClient}
                            >
                                Vincular a mi lista
                            </Button>
                        }
                    >
                        <Typography variant="body2" fontWeight="bold">
                            Este cliente ya existe: {cedulaCheck.cliente?.nombre} {cedulaCheck.cliente?.apellido}
                        </Typography>
                        <Typography variant="caption">
                            Puede vincularlo a su lista para poder usarlo en préstamos.
                        </Typography>
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {/* Información Personal */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
                            Información Personal
                        </Typography>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Nombre"
                            fullWidth
                            required
                            value={formData.nombre}
                            onChange={handleChange('nombre')}
                            onBlur={handleNameBlur('nombre')}
                            error={!!errors.nombre}
                            helperText={errors.nombre}
                            InputProps={{ sx: { borderRadius: 3 } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Apellido"
                            fullWidth
                            required
                            value={formData.apellido}
                            onChange={handleChange('apellido')}
                            onBlur={handleNameBlur('apellido')}
                            error={!!errors.apellido}
                            helperText={errors.apellido}
                            InputProps={{ sx: { borderRadius: 3 } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Cédula / DNI"
                            fullWidth
                            required
                            value={formData.cedula}
                            onChange={handleChange('cedula')}
                            onBlur={handleCedulaBlur}
                            error={!!errors.cedula}
                            helperText={errors.cedula || (cedulaCheck.checking ? 'Verificando...' : '')}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><BadgeIcon color="action" fontSize="small" /></InputAdornment>,
                                endAdornment: cedulaCheck.checking ? (
                                    <CircularProgress size={16} />
                                ) : cedulaCheck.exists ? (
                                    <WarningIcon color="warning" fontSize="small" />
                                ) : formData.cedula && !errors.cedula ? (
                                    <CheckCircleIcon color="success" fontSize="small" />
                                ) : null,
                                sx: { borderRadius: 3 }
                            }}
                        />
                    </Grid>

                    {/* Contacto */}
                    <Grid item xs={12} sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
                            Contacto
                        </Typography>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Select
                                value={formData.countryCode}
                                onChange={handleChange('countryCode')}
                                sx={{ borderRadius: 3, minWidth: 100 }}
                            >
                                {COUNTRY_CODES.map(c => (
                                    <MenuItem key={c.code} value={c.code}>
                                        {c.code} ({c.country})
                                    </MenuItem>
                                ))}
                            </Select>
                            <TextField
                                label="Móvil / WhatsApp"
                                fullWidth
                                required
                                value={formData.movil}
                                onChange={handleChange('movil')}
                                error={!!errors.movil}
                                helperText={errors.movil}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><PhoneIcon color="action" fontSize="small" /></InputAdornment>,
                                    sx: { borderRadius: 3 }
                                }}
                            />
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Email"
                            fullWidth
                            required
                            value={formData.email}
                            onChange={handleChange('email')}
                            error={!!errors.email}
                            helperText={errors.email}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><EmailIcon color="action" fontSize="small" /></InputAdornment>,
                                sx: { borderRadius: 3 }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Dirección"
                            fullWidth
                            value={formData.direccion}
                            onChange={handleChange('direccion')}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><HomeIcon color="action" fontSize="small" /></InputAdornment>,
                                sx: { borderRadius: 3 }
                            }}
                        />
                    </Grid>

                    {/* Otros */}
                    <Grid item xs={12}>
                        <TextField
                            label="Notas adicionales"
                            multiline
                            rows={3}
                            fullWidth
                            value={formData.notas}
                            onChange={handleChange('notas')}
                            InputProps={{
                                startAdornment: <InputAdornment position="start" sx={{ mt: 1.5 }}><NoteIcon color="action" fontSize="small" /></InputAdornment>,
                                sx: { borderRadius: 3 }
                            }}
                        />
                    </Grid>

                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
                <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 3 }}>Cancelar</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={isSubmitting || cedulaCheck.exists}
                    sx={{ borderRadius: 3, px: 4 }}
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ClienteFormModal;

