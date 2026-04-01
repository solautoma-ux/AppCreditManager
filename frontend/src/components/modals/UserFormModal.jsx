import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    InputAdornment,
    Divider,
    IconButton,
    Alert,
    MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import LockIcon from '@mui/icons-material/LockRounded';
import InfoIcon from '@mui/icons-material/InfoOutlined';

/**
 * Opciones de tipo de plan disponibles para suscriptores
 * - mensual: 30 días de acceso
 * - anual: 365 días de acceso
 * - prueba_gratis: 30 días gratuitos (solo para creación)
 */
const PLAN_OPTIONS = [
    { value: 'mensual', label: 'Mensual', days: 30 },
    { value: 'anual', label: 'Anual', days: 365 },
    { value: 'prueba_gratis', label: 'Prueba Gratis (1 mes)', days: 30 }
];

/**
 * Calcula la fecha de vencimiento a partir de la fecha de inicio y el tipo de plan
 * @param {string} str_fechaInicio - Fecha de inicio en formato ISO (YYYY-MM-DD)
 * @param {string} str_tipoPlan - Tipo de plan (mensual, anual, prueba_gratis)
 * @returns {string} Fecha de vencimiento en formato ISO (YYYY-MM-DD)
 */
const calcularFechaVencimiento = (str_fechaInicio, str_tipoPlan) => {
    const plan = PLAN_OPTIONS.find(p => p.value === str_tipoPlan);
    if (!plan || !str_fechaInicio) return '';

    // Parsear fecha manualmente para evitar problemas de zona horaria
    const [year, month, day] = str_fechaInicio.split('-').map(Number);
    const date_inicio = new Date(year, month - 1, day); // month es 0-indexed en JS

    // Sumar días según el plan
    date_inicio.setDate(date_inicio.getDate() + plan.days);

    // Formatear manualmente a YYYY-MM-DD
    const int_year = date_inicio.getFullYear();
    const int_month = String(date_inicio.getMonth() + 1).padStart(2, '0');
    const int_day = String(date_inicio.getDate()).padStart(2, '0');

    return `${int_year}-${int_month}-${int_day}`;
};

/**
 * Modal de formulario para Crear/Editar Usuarios (Admin o Encargado)
 * Incluye selector de tipo de plan y cálculo automático de fecha de vencimiento
 * 
 * @param {boolean} open - Estado de visibilidad del modal
 * @param {function} onClose - Función para cerrar el modal
 * @param {function} onSubmit - Función para enviar el formulario
 * @param {string} mode - 'create' o 'edit'
 * @param {string} userType - 'admin' o 'encargado' (define el rol bloqueado)
 * @param {object} initialData - Datos iniciales para edición
 */
const UserFormModal = ({
    open,
    onClose,
    onSubmit,
    mode = 'create',
    userType = 'admin',
    initialData = null
}) => {
    // Estado del formulario
    const [formData, setFormData] = useState({
        email: '',
        nombre: '',
        apellido: '',
        cedula: '',
        movil: '',
        estado: 'activo',
        // Campos solo para admin
        tipoPlan: 'mensual',
        montoSuscripcion: 500000,
        fechaInicioSuscripcion: new Date().toISOString().split('T')[0],
        fechaVencimiento: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Cargar datos iniciales en modo edición
    useEffect(() => {
        if (initialData && mode === 'edit') {
            setFormData({
                email: initialData.email || '',
                nombre: initialData.nombre || '',
                apellido: initialData.apellido || '',
                cedula: initialData.cedula || '',
                movil: initialData.movil || '',
                estado: initialData.estado || 'activo',
                tipoPlan: initialData.suscripcion?.tipo_plan || 'mensual',
                montoSuscripcion: initialData.suscripcion?.monto_mensual || 500000,
                fechaInicioSuscripcion: initialData.suscripcion?.fecha_inicio_suscripcion || new Date().toISOString().split('T')[0],
                fechaVencimiento: initialData.suscripcion?.fecha_proximo_pago || ''
            });
        } else {
            // Reset form para modo creación
            const str_hoy = new Date().toISOString().split('T')[0];
            setFormData({
                email: '',
                nombre: '',
                apellido: '',
                cedula: '',
                movil: '',
                estado: 'activo',
                tipoPlan: 'mensual',
                montoSuscripcion: 500000,
                fechaInicioSuscripcion: str_hoy,
                fechaVencimiento: calcularFechaVencimiento(str_hoy, 'mensual')
            });
        }
        setErrors({});
    }, [initialData, mode, open]);

    // Recalcular fecha de vencimiento cuando cambia el tipo de plan o la fecha de inicio
    useEffect(() => {
        if (userType === 'admin' && formData.estado !== 'pendiente') {
            const str_nuevaFecha = calcularFechaVencimiento(formData.fechaInicioSuscripcion, formData.tipoPlan);
            setFormData(prev => ({ ...prev, fechaVencimiento: str_nuevaFecha }));
        }
    }, [formData.tipoPlan, formData.fechaInicioSuscripcion, userType, formData.estado]);

    // Helper para Title Case
    const toTitleCase = (str) => {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    // Manejar cambios en los campos
    const handleChange = (field) => (event) => {
        let value = event.target.value;

        // Auto-capitalizar Nombre y Apellido
        if (field === 'nombre' || field === 'apellido') {
            value = toTitleCase(value);
        }

        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Limpiar error al editar
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }

        // Validación inmediata de Email
        if (field === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!value) {
                setErrors(prev => ({ ...prev, email: 'El email es requerido' }));
            } else if (!emailRegex.test(value)) {
                setErrors(prev => ({ ...prev, email: 'Formato de email inválido' }));
            } else {
                setErrors(prev => ({ ...prev, email: null }));
            }
        }
    };

    // Si el plan es prueba_gratis, forzar monto a 0
    useEffect(() => {
        if (formData.tipoPlan === 'prueba_gratis') {
            setFormData(prev => ({ ...prev, montoSuscripcion: 0 }));
        }
    }, [formData.tipoPlan]);

    // Validar formulario
    const validateForm = () => {
        const newErrors = {};

        // Email requerido y formato válido
        if (!formData.email.trim()) {
            newErrors.email = 'El email es requerido';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Formato de email inválido';
        }

        // Nombre requerido
        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es requerido';
        } else if (formData.nombre.trim().length < 2) {
            newErrors.nombre = 'Mínimo 2 caracteres';
        }

        // Apellido requerido
        if (!formData.apellido.trim()) {
            newErrors.apellido = 'El apellido es requerido';
        } else if (formData.apellido.trim().length < 2) {
            newErrors.apellido = 'Mínimo 2 caracteres';
        }

        // Suscripción requerida para admins (excepto prueba gratis)
        if (userType === 'admin' && mode === 'create' && formData.tipoPlan !== 'prueba_gratis') {
            if (!formData.montoSuscripcion || formData.montoSuscripcion <= 0) {
                newErrors.montoSuscripcion = 'El monto debe ser mayor a 0';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Enviar formulario
    const handleSubmit = async () => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            // Preparar payload limpio
            const payload = { ...formData, rol: userType };

            // Eliminar campos de suscripción si no es admin
            if (userType !== 'admin') {
                delete payload.tipoPlan;
                delete payload.montoSuscripcion;
                delete payload.fechaInicioSuscripcion;
                delete payload.fechaVencimiento;
            }

            await onSubmit(payload);
            onClose();
        } catch (error) {
            console.error('Error submitting form:', error);
            setErrors({ submit: error.message || 'Error al guardar' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Determinar título según modo y tipo
    const getTitle = () => {
        if (mode === 'edit') {
            return `Editar: ${formData.nombre} ${formData.apellido}`;
        }
        return userType === 'admin' ? 'Nuevo Suscriptor' : 'Nuevo Encargado';
    };

    // Determinar etiqueta del rol
    const getRoleLabel = () => {
        return userType === 'admin' ? 'Administrador' : 'Encargado';
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            scroll="body"
            PaperProps={{
                sx: { borderRadius: '8px' }
            }}
        >
            <DialogTitle component="div" sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pt: 3,
                px: 3,
                pb: 1
            }}>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.3rem' }}>
                    👤 {getTitle()}
                </Typography>
                <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'action.hover' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 3 }}>
                {errors.submit && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                        {errors.submit}
                    </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* Email */}
                    <Box>
                        <TextField
                            label="Email (para Google Auth)"
                            fullWidth
                            required
                            value={formData.email}
                            onChange={handleChange('email')}
                            error={!!errors.email}
                            helperText={errors.email}
                            disabled={mode === 'edit' && formData.estado !== 'pendiente'}
                            InputProps={{
                                startAdornment: (mode === 'edit' && formData.estado !== 'pendiente') ? (
                                    <InputAdornment position="start">
                                        <LockIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ) : null,
                                sx: { borderRadius: '8px' }
                            }}
                            placeholder="usuario@gmail.com"
                        />
                        {mode === 'create' && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <InfoIcon fontSize="inherit" /> El usuario ingresará con este email
                            </Typography>
                        )}
                    </Box>

                    {/* Nombre y Apellido */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label="Nombre"
                            fullWidth
                            required
                            value={formData.nombre}
                            onChange={handleChange('nombre')}
                            error={!!errors.nombre}
                            helperText={errors.nombre}
                            InputProps={{ sx: { borderRadius: '8px' } }}
                        />
                        <TextField
                            label="Apellido"
                            fullWidth
                            required
                            value={formData.apellido}
                            onChange={handleChange('apellido')}
                            error={!!errors.apellido}
                            helperText={errors.apellido}
                            InputProps={{ sx: { borderRadius: '8px' } }}
                        />
                    </Box>

                    {/* Cédula y Móvil */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label="Cédula"
                            fullWidth
                            value={formData.cedula}
                            onChange={handleChange('cedula')}
                            InputProps={{ sx: { borderRadius: '8px' } }}
                        />
                        <TextField
                            label="Móvil"
                            fullWidth
                            value={formData.movil}
                            onChange={handleChange('movil')}
                            InputProps={{ sx: { borderRadius: '8px' } }}
                            placeholder="+57 300 123 4567"
                        />
                    </Box>

                    {/* Rol (bloqueado) */}
                    <TextField
                        label="Rol"
                        fullWidth
                        value={getRoleLabel()}
                        disabled
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LockIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: '8px', bgcolor: 'action.hover' }
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: -2 }}>
                        <InfoIcon fontSize="inherit" /> El rol se define automáticamente
                    </Typography>

                    {/* Sección de Suscripción (solo para admins) */}
                    {userType === 'admin' && (
                        <>
                            <Divider sx={{ my: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Suscripción
                                </Typography>
                            </Divider>

                            {/* Tipo de Plan */}
                            <TextField
                                select
                                label="Tipo de Plan"
                                fullWidth
                                required
                                value={formData.tipoPlan}
                                onChange={handleChange('tipoPlan')}
                                disabled={mode === 'edit' && formData.estado === 'pendiente'}
                                InputProps={{ sx: { borderRadius: '8px' } }}
                            >
                                {PLAN_OPTIONS
                                    .filter(opt => mode === 'create' || opt.value !== 'prueba_gratis')
                                    .map(opt => (
                                        <MenuItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </MenuItem>
                                    ))
                                }
                            </TextField>
                            {mode === 'edit' && formData.estado === 'pendiente' && (
                                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                                    ⚠️ La suscripción se activará cuando el admin acepte la invitación
                                </Typography>
                            )}

                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {/* Monto mensual – deshabilitado si prueba gratis O si está pendiente */}
                                <TextField
                                    label="Monto mensual"
                                    fullWidth
                                    required={formData.tipoPlan !== 'prueba_gratis'}
                                    type="number"
                                    value={formData.montoSuscripcion}
                                    onChange={handleChange('montoSuscripcion')}
                                    error={!!errors.montoSuscripcion}
                                    helperText={errors.montoSuscripcion || (formData.tipoPlan === 'prueba_gratis' ? 'Gratis por 1 mes' : '')}
                                    disabled={formData.tipoPlan === 'prueba_gratis' || (mode === 'edit' && formData.estado === 'pendiente')}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                        sx: { borderRadius: '8px' }
                                    }}
                                />
                                {/* Fecha inicio - SIEMPRE visible (creación Y edición), pero deshabilitada si pendiente */}
                                <TextField
                                    label="Fecha inicio"
                                    fullWidth
                                    type="date"
                                    value={formData.fechaInicioSuscripcion}
                                    onChange={handleChange('fechaInicioSuscripcion')}
                                    disabled={mode === 'edit' && formData.estado === 'pendiente'}
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{ sx: { borderRadius: '8px' } }}
                                />
                            </Box>

                            {/* Fecha de vencimiento calculada (solo lectura en creación, editable en edición) */}
                            {mode === 'create' && formData.fechaVencimiento && (
                                <Alert severity="info" sx={{ borderRadius: '8px' }}>
                                    📅 La suscripción vencerá el <strong>{new Date(formData.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                                </Alert>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, gap: 1 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    sx={{ borderRadius: '8px', px: 3, py: 1 }}
                >
                    Cancelar
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disableElevation
                    disabled={isSubmitting}
                    sx={{ borderRadius: '8px', px: 4, py: 1 }}
                >
                    {isSubmitting ? 'Guardando...' : (mode === 'create' ? `Crear ${getRoleLabel()}` : 'Guardar Cambios')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UserFormModal;
