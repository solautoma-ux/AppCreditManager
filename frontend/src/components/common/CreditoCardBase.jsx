import React from 'react';
import { Box, Typography, Paper, Chip, Grid, Button, LinearProgress } from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    WhatsApp as WhatsAppIcon,
    Today as TodayIcon,
    AutorenewRounded as AutorenewIcon,
    CheckCircleOutlineRounded as CheckCircleIcon,
    DeleteOutlineRounded as DeleteIcon
} from '@mui/icons-material';

/**
 * Componente base para renderizar la tarjeta de un crédito o un pago programado.
 * Implementa las reglas de arquitectura centralizando la UI y cálculos.
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.obj_credito - Objeto con los datos del crédito
 * @param {Object} [props.obj_paymentItem] - Objeto opcional si la tarjeta representa un pago específico (ej. Home)
 * @param {boolean} [props.bol_isOverdue] - Indica si la tarjeta representa un pago vencido
 * @param {number} [props.int_overdueDays] - Cantidad de días de mora
 * @param {Function} props.onPay - Handler para registrar un cobro
 * @param {Function} props.onNotify - Handler para notificar por WhatsApp
 * @param {Function} props.onRefinance - Handler para refinanciar
 * @param {Function} props.onLiquidate - Handler para interrumpir
 * @param {Function} props.onDelete - Handler para borrar
 */
const CreditoCardBase = ({
    obj_credito,
    obj_paymentItem,
    bol_isOverdue = false,
    int_overdueDays = 0,
    onPay,
    onNotify,
    onRefinance,
    onLiquidate,
    onDelete
}) => {
    const obj_cliente = obj_credito?.cliente;

    // Cálculo de finanzas usando tipado estricto
    const dbl_saldoPendiente = (obj_credito?.saldo_capital_pendiente || 0) + (obj_credito?.saldo_interes_pendiente || 0);
    const dbl_totalPagado = (obj_credito?.monto_total || 0) - dbl_saldoPendiente;
    const dbl_progreso = obj_credito?.monto_total ? (dbl_totalPagado / obj_credito.monto_total) * 100 : 0;

    const bol_isTerminado = ['pagado', 'interrumpido', 'refinanciado'].includes(obj_credito?.estado);

    const str_severity = int_overdueDays > 3 ? 'error' : int_overdueDays > 0 ? 'warning' : 'success';

    const getStatusInfo = () => {
        switch (obj_credito?.estado) {
            case 'activo': return { str_label: 'ACTIVO', str_color: 'primary' };
            case 'vencido': return { str_label: 'VENCIDO', str_color: 'error' };
            case 'pagado': return { str_label: 'PAGADO', str_color: 'success' };
            case 'interrumpido': return { str_label: 'INTERRUMPIDO', str_color: 'warning' };
            case 'refinanciado': return { str_label: 'REFINANCIADO', str_color: 'info' };
            default: return { str_label: obj_credito?.estado?.toUpperCase() || 'DESCONOCIDO', str_color: 'default' };
        }
    };

    const obj_statusInfo = getStatusInfo();

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    const formatDate = (dateString) => {
        if (!dateString) return '---';
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    };

    return (
        <Paper
            elevation={0}
            onClick={(e) => {
                // Si es un payment item o no está terminado, permitimos click para pagar
                if (!bol_isTerminado && obj_paymentItem && onPay) {
                    onPay(obj_paymentItem);
                }
            }}
            sx={{
                p: 3,
                height: '100%',
                borderRadius: '16px',
                border: '2px solid',
                borderColor: bol_isTerminado
                    ? (obj_statusInfo.str_color === 'warning' ? 'warning.main' : obj_statusInfo.str_color === 'info' ? 'info.main' : 'success.main')
                    : (bol_isOverdue ? 'error.main' : 'divider'),
                bgcolor: bol_isTerminado
                    ? (obj_statusInfo.str_color === 'warning' ? 'warning.lighter' : obj_statusInfo.str_color === 'info' ? 'rgba(2, 136, 209, 0.04)' : 'rgba(76, 175, 80, 0.03)')
                    : 'background.paper',
                cursor: (!bol_isTerminado && obj_paymentItem) ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: bol_isTerminado
                        ? (obj_statusInfo.str_color === 'warning' ? 'warning.main' : obj_statusInfo.str_color === 'info' ? 'info.main' : 'success.main')
                        : (bol_isOverdue ? 'error.main' : 'primary.main'),
                    boxShadow: bol_isTerminado
                        ? '0 12px 24px -10px rgba(0,0,0,0.1)'
                        : '0 12px 24px -10px rgba(59, 130, 246, 0.15)'
                }
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight="bold">
                        {obj_cliente?.nombre} {obj_cliente?.apellido}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {obj_credito?.cartera?.nombre} {obj_paymentItem && `• Cuota ${obj_paymentItem.numero_cuota}`}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Chip
                        label={obj_statusInfo.str_label}
                        size="small"
                        color={obj_statusInfo.str_color}
                        variant={bol_isTerminado ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 'bold' }}
                    />
                    {bol_isOverdue && int_overdueDays > 0 && (
                        <Chip
                            label={`${int_overdueDays} días mora`}
                            size="small"
                            color={str_severity}
                            sx={{ fontWeight: 'bold', height: 20, fontSize: '0.65rem' }}
                        />
                    )}
                </Box>
            </Box>

            <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Deuda Total</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatCurrency(obj_credito?.monto_total)}</Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Pagado</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                        {formatCurrency(dbl_totalPagado)}
                    </Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Pendiente</Typography>
                    <Typography variant="body2" fontWeight="bold" color={bol_isTerminado ? 'success.main' : 'error.main'}>
                        {formatCurrency(dbl_saldoPendiente)}
                    </Typography>
                </Grid>
            </Grid>

            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption">Progreso</Typography>
                    <Typography variant="caption">{dbl_progreso.toFixed(0)}%</Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={Math.min(dbl_progreso, 100)}
                    sx={{ borderRadius: 2, height: 6 }}
                    color={bol_isTerminado ? 'success' : 'primary'}
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
                        <TodayIcon fontSize="small" />
                        <span>Prox: {formatDate(obj_paymentItem ? obj_paymentItem.fecha_vencimiento : obj_credito?.fecha_proximo_pago)}</span>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {(obj_credito?.tasa_interes !== undefined && obj_credito?.tasa_interes !== null) && (
                            <Typography variant="caption" fontWeight="bold" sx={{ color: 'text.secondary' }}>
                                Tasa: {obj_credito.tasa_interes}%
                            </Typography>
                        )}
                        {obj_paymentItem && (
                            <Typography variant="subtitle2" fontWeight="bold" color="success.main">
                                {formatCurrency(obj_paymentItem.monto_cuota)}
                            </Typography>
                        )}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {!bol_isTerminado && onPay && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<MoneyIcon />}
                            onClick={(e) => { e.stopPropagation(); onPay(obj_paymentItem || obj_credito); }}
                            sx={{ borderRadius: '8px', textTransform: 'none', flexGrow: 1 }}
                        >
                            Cobrar
                        </Button>
                    )}
                    {!bol_isTerminado && obj_cliente?.movil && onNotify && (
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<WhatsAppIcon />}
                            onClick={(e) => { e.stopPropagation(); onNotify(obj_paymentItem || obj_credito); }}
                            sx={{
                                color: '#25D366', borderColor: '#25D366', borderRadius: '8px', textTransform: 'none', flexGrow: 1,
                                '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.1)', borderColor: '#25D366' }
                            }}
                        >
                            Notificar
                        </Button>
                    )}
                    {!bol_isTerminado && onRefinance && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="info"
                            startIcon={<AutorenewIcon />}
                            onClick={(e) => { e.stopPropagation(); onRefinance(obj_credito); }}
                            sx={{ borderRadius: '8px', textTransform: 'none', flexGrow: 1 }}
                        >
                            Refinanciar
                        </Button>
                    )}
                    {!bol_isTerminado && onLiquidate && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<CheckCircleIcon />}
                            onClick={(e) => { e.stopPropagation(); onLiquidate(obj_credito); }}
                            sx={{ borderRadius: '8px', textTransform: 'none', flexGrow: 1 }}
                        >
                            Interrumpir
                        </Button>
                    )}
                    {obj_credito?.estado === 'activo' && dbl_totalPagado === 0 && onDelete && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => { e.stopPropagation(); onDelete(obj_credito); }}
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

export default CreditoCardBase;
