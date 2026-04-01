import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    TextField,
    MenuItem,
    Divider,
    IconButton,
    Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import AutorenewIcon from '@mui/icons-material/AutorenewRounded';

/**
 * Opciones de renovación (sin prueba gratis)
 */
const RENEWAL_OPTIONS = [
    { value: 'mensual', label: 'Mensual (30 días)', days: 30, price: 50000 },
    { value: 'anual', label: 'Anual (365 días)', days: 365, price: 500000 } // 10 meses (2 gratis)
];

/**
 * Modal de confirmación para renovar la suscripción de un administrador.
 * El super admin selecciona el tipo de plan (sin prueba gratis) y se calcula
 * automáticamente la nueva fecha de vencimiento.
 *
 * @param {boolean} open - Estado de visibilidad
 * @param {function} onClose - Cerrar modal
 * @param {function} onConfirm - Callback al confirmar (recibe { tipoPlan, fechaVencimiento })
 * @param {object} admin - Datos del administrador a renovar
 */
const RenewalModal = ({ open, onClose, onConfirm, admin }) => {
    const [str_tipoPlan, setTipoPlan] = useState('mensual');
    const [int_montoPersonalizado, setMontoPersonalizado] = useState(500000); // Default mensual
    const [bol_submitting, setSubmitting] = useState(false);

    // Calcular nueva fecha de vencimiento desde HOY
    const calcularNuevaFecha = () => {
        const plan = RENEWAL_OPTIONS.find(p => p.value === str_tipoPlan);
        if (!plan) return null;
        const date_nueva = new Date();
        date_nueva.setDate(date_nueva.getDate() + plan.days);
        return date_nueva;
    };

    const date_nuevaFecha = calcularNuevaFecha();

    // Actualizar monto al cambiar plan
    const handlePlanChange = (e) => {
        const newPlan = e.target.value;
        setTipoPlan(newPlan);
        const planOption = RENEWAL_OPTIONS.find(p => p.value === newPlan);
        if (planOption) {
            setMontoPersonalizado(planOption.price);
        }
    };

    // Confirmar renovación
    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            const selectedOption = RENEWAL_OPTIONS.find(o => o.value === str_tipoPlan);

            await onConfirm({
                tipo_plan: str_tipoPlan,
                monto: int_montoPersonalizado, // Usar el monto editado
                dias_duracion: selectedOption.days
            });
            onClose();
        } catch (err) {
            console.error('Error en renovación:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '8px' } }}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="bold">
                    🔄 Renovar Suscripción
                </Typography>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 3 }}>
                {admin && (
                    <Alert severity="info" sx={{ mb: 3, borderRadius: '8px' }}>
                        Renovar suscripción de <strong>{admin.nombre} {admin.apellido}</strong>
                    </Alert>
                )}

                {/* Selector de tipo de plan */}
                <TextField
                    select
                    label="Nuevo tipo de plan"
                    fullWidth
                    value={str_tipoPlan}
                    onChange={handlePlanChange}
                    InputProps={{ sx: { borderRadius: '8px' } }}
                    sx={{ mb: 3 }}
                >
                    {RENEWAL_OPTIONS.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </MenuItem>
                    ))}
                </TextField>

                {/* Campo de Monto Personalizado */}
                <TextField
                    label="Monto a Pagar (COP)"
                    fullWidth
                    type="number"
                    value={int_montoPersonalizado}
                    onChange={(e) => setMontoPersonalizado(Number(e.target.value))}
                    InputProps={{ sx: { borderRadius: '8px' } }}
                    helperText="Este valor se sumará al total recaudado"
                    sx={{ mb: 3 }}
                />

                {/* Preview de nueva fecha */}
                {date_nuevaFecha && (
                    <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: '8px', textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Nueva fecha de vencimiento:</Typography>
                        <Typography variant="h6" fontWeight="bold" color="success.main">
                            {date_nuevaFecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={onClose} variant="outlined" sx={{ borderRadius: '8px' }}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="primary"
                    startIcon={<AutorenewIcon />}
                    disabled={bol_submitting}
                    sx={{ borderRadius: '8px' }}
                >
                    {bol_submitting ? 'Renovando...' : 'Confirmar Renovación'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RenewalModal;
