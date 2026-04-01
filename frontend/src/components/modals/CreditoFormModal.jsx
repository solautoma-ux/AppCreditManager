import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, IconButton,
    Grid, Divider, Alert, Stepper, Step, StepLabel,
    MenuItem, InputAdornment, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, Autocomplete, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import SaveIcon from '@mui/icons-material/SaveRounded';
import AttachMoneyIcon from '@mui/icons-material/AttachMoneyRounded';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthRounded';

import { useAuth } from '../../context/AuthContext';
import { clienteService } from '../../services/clienteService';
import { carteraService } from '../../services/carteraService';
import { creditoService } from '../../services/creditoService';

const steps = ['Cliente y Cartera', 'Términos', 'Confirmar'];

const CreditoFormModal = ({ open, onClose, onSuccess, refinanceCredito = null }) => {
    const { user } = useAuth();
    const [activeStep, setActiveStep] = useState(0);
    const [loadingData, setLoadingData] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Listas para selects
    const [clientes, setClientes] = useState([]);
    const [carteras, setCarteras] = useState([]);

    // Form Data
    const [formData, setFormData] = useState({
        cliente_id: '',
        cartera_id: '',
        monto_capital: '',
        tasa_interes: '20', // Default 20%
        numero_cuotas: '24', // Default 24 diarias
        frecuencia: 'diaria',
        fecha_inicio: new Date().toISOString().split('T')[0]
    });

    // Simulacion
    const [simulation, setSimulation] = useState(null);

    // Cargar datos iniciales
    useEffect(() => {
        if (open) {
            setActiveStep(refinanceCredito ? 1 : 0);
            const saldoTotalPendiente = refinanceCredito
                ? ((refinanceCredito.saldo_capital_pendiente || 0) + (refinanceCredito.saldo_interes_pendiente || 0))
                : '';

            setFormData({
                cliente_id: refinanceCredito?.cliente_id || '',
                cartera_id: refinanceCredito?.cartera_id || '',
                monto_capital: saldoTotalPendiente.toString(),
                tasa_interes: '20',
                numero_cuotas: '24',
                frecuencia: 'diaria',
                fecha_inicio: new Date().toISOString().split('T')[0]
            });
            setSimulation(null);
            setError(null);
            loadLists();
        }
    }, [open, refinanceCredito]);

    const loadLists = async () => {
        setLoadingData(true);
        try {
            const [clientesData, carterasData] = await Promise.all([
                clienteService.getClientes(),
                carteraService.getCarteras()
            ]);
            setClientes(clientesData || []);
            setCarteras(carterasData || []);
        } catch (err) {
            setError('Error cargando listas: ' + err.message);
        } finally {
            setLoadingData(false);
        }
    };

    // Calcular simulación cuando cambian los términos
    useEffect(() => {
        if (
            formData.monto_capital &&
            formData.tasa_interes &&
            formData.numero_cuotas &&
            activeStep >= 1
        ) {
            const sim = creditoService.simularCredito(
                formData.monto_capital,
                formData.tasa_interes,
                formData.numero_cuotas,
                formData.frecuencia,
                formData.fecha_inicio
            );
            setSimulation(sim);
        }
    }, [formData, activeStep]);

    const handleChange = (field) => (e) => {
        setFormData({ ...formData, [field]: e.target.value });
        setError(null);
    };

    const validateStep = () => {
        if (activeStep === 0) {
            if (!formData.cliente_id) return 'Selecciona un cliente';
            if (!formData.cartera_id) return 'Selecciona una cartera';

            // Validar saldo
            const cartera = carteras.find(c => c.id === formData.cartera_id);
            if (cartera && cartera.saldo_actual <= 0) return 'La cartera seleccionada no tiene saldo ($0)';
        }
        if (activeStep === 1) {
            if (!formData.monto_capital || parseFloat(formData.monto_capital) <= 0) return 'Ingresa un monto válido';
            if (!formData.tasa_interes) return 'Ingresa la tasa';
            if (!formData.numero_cuotas) return 'Ingresa el # cuotas';

            // Validar monto <= saldo cartera
            const cartera = carteras.find(c => c.id === formData.cartera_id);
            if (cartera && parseFloat(formData.monto_capital) > cartera.saldo_actual) {
                return `Saldo insuficiente. Disponible: $${cartera.saldo_actual.toLocaleString()}`;
            }
        }
        return null;
    };

    const handleNext = () => {
        const err = validateStep();
        if (err) {
            setError(err);
            return;
        }
        setActiveStep((prev) => prev + 1);
        setError(null);
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
        setError(null);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const adminId = user.rol === 'encargado' ? user.admin_padre_id : user.id;

            if (refinanceCredito) {
                // Modo Refinanciación
                await creditoService.refinanciarCredito(refinanceCredito.id, {
                    ...formData,
                    admin_id: adminId,
                    simulation
                });
            } else {
                // Modo Nuevo Crédito Normal
                await creditoService.createCredito({
                    ...formData,
                    admin_id: adminId,
                    simulation
                });
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || 'Error al procesar crédito');
        } finally {
            setSubmitting(false);
        }
    };

    // Helpers
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);
    const selectedCartera = carteras.find(c => c.id === formData.cartera_id);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: '16px' } }}
        >
            <DialogTitle sx={{ pb: 0 }}>
                <Typography variant="h6" fontWeight="bold">
                    {refinanceCredito ? 'Refinanciar Préstamo' : 'Nuevo Préstamo'}
                </Typography>
            </DialogTitle>

            <Box sx={{ px: 3, pt: 2 }}>
                <Stepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Box>

            <DialogContent sx={{ minHeight: 400, pt: 4 }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {activeStep === 0 && (
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Autocomplete
                                options={clientes}
                                getOptionLabel={(option) => `${option.nombre} ${option.apellido} - ${option.cedula}`}
                                value={clientes.find(c => c.id === formData.cliente_id) || null}
                                disabled={!!refinanceCredito}
                                onChange={(event, newValue) => {
                                    setFormData({ ...formData, cliente_id: newValue?.id || '' });
                                    setError(null);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Cliente"
                                        placeholder="Escribe para buscar..."
                                        InputProps={{
                                            ...params.InputProps,
                                            sx: { borderRadius: 3 }
                                        }}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                noOptionsText="No se encontraron clientes"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                select
                                label="Cartera (Fondo)"
                                fullWidth
                                SelectProps={{ native: true }}
                                value={formData.cartera_id}
                                disabled={!!refinanceCredito}
                                onChange={handleChange('cartera_id')}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{ sx: { borderRadius: 3 } }}
                                helperText={selectedCartera ? `Saldo disponible: ${formatCurrency(selectedCartera.saldo_actual)}` : ''}
                            >
                                <option value="">-- Seleccionar --</option>
                                {carteras.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.nombre} (${c.saldo_actual.toLocaleString()})
                                    </option>
                                ))}
                            </TextField>
                        </Grid>
                    </Grid>
                )}

                {activeStep === 1 && (
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Monto a Prestar"
                                fullWidth
                                type="number"
                                value={formData.monto_capital}
                                onChange={handleChange('monto_capital')}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                    sx: { borderRadius: 3 }
                                }}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField
                                label="Tasa (%)"
                                fullWidth
                                type="number"
                                value={formData.tasa_interes}
                                onChange={handleChange('tasa_interes')}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                    sx: { borderRadius: 3 }
                                }}
                                helperText="Ganancia total"
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TextField
                                label="Frecuencia"
                                select
                                fullWidth
                                SelectProps={{ native: true }}
                                value={formData.frecuencia}
                                onChange={handleChange('frecuencia')}
                                InputProps={{ sx: { borderRadius: 3 } }}
                            >
                                <option value="diaria">Diaria</option>
                                <option value="semanal">Semanal</option>
                                <option value="quincenal">Quincenal</option>
                                <option value="mensual">Mensual</option>
                                <option value="unico">Pago Único</option>
                            </TextField>
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Plazo (# Cuotas)"
                                fullWidth
                                type="number"
                                value={formData.numero_cuotas}
                                onChange={handleChange('numero_cuotas')}
                                InputProps={{ sx: { borderRadius: 3 } }}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <TextField
                                label="Fecha Inicio"
                                fullWidth
                                type="date"
                                value={formData.fecha_inicio}
                                onChange={handleChange('fecha_inicio')}
                                InputProps={{ sx: { borderRadius: 3 } }}
                            />
                        </Grid>

                        {/* Preview Rapido */}
                        {simulation && (
                            <Grid item xs={12}>
                                <Alert severity="info" icon={<AttachMoneyIcon />}>
                                    Cuota estimada: <strong>{formatCurrency(simulation.totales.valorCuota)}</strong>
                                    <br />
                                    Total a devolver: <strong>{formatCurrency(simulation.totales.total)}</strong>
                                </Alert>
                            </Grid>
                        )}
                    </Grid>
                )}

                {activeStep === 2 && simulation && (
                    <Box>
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={4}>
                                <Typography variant="caption" color="text.secondary">Prestado</Typography>
                                <Typography variant="h6">{formatCurrency(simulation.totales.capital)}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="caption" color="text.secondary">Interés (Ganancia)</Typography>
                                <Typography variant="h6" color="success.main">+{formatCurrency(simulation.totales.interes)}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="caption" color="text.secondary">Total Deuda</Typography>
                                <Typography variant="h6" fontWeight="bold">{formatCurrency(simulation.totales.total)}</Typography>
                            </Grid>
                        </Grid>

                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Plan de Pagos ({formData.numero_cuotas} cuotas {formData.frecuencia}s)</Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>#</TableCell>
                                        <TableCell>Fecha</TableCell>
                                        <TableCell align="right">Cuota</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {simulation.cuotas.map((cuota) => (
                                        <TableRow key={cuota.numero}>
                                            <TableCell>{cuota.numero}</TableCell>
                                            <TableCell>{cuota.fecha_vencimiento}</TableCell>
                                            <TableCell align="right">{formatCurrency(cuota.monto_cuota)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
                <Button onClick={onClose} disabled={submitting} sx={{ borderRadius: 3 }}>
                    Cancelar
                </Button>

                {activeStep > 0 && (
                    <Button onClick={handleBack} disabled={submitting} startIcon={<ArrowBackIcon />} sx={{ borderRadius: 3 }}>
                        Atrás
                    </Button>
                )}

                {activeStep < steps.length - 1 ? (
                    <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />} sx={{ borderRadius: 3 }}>
                        Siguiente
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        color="success"
                        onClick={handleSubmit}
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
                        sx={{ borderRadius: 3, px: 3 }}
                    >
                        {refinanceCredito ? 'Confirmar Refinanciación' : 'Confirmar Préstamo'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default CreditoFormModal;
