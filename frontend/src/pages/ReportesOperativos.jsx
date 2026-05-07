import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    MenuItem,
    TextField,
    Button,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Tab,
    Chip,
    CircularProgress,
    Tooltip as MuiTooltip,
    useTheme,
    useMediaQuery,
    TableSortLabel,
    Divider
} from '@mui/material';
import {
    Download as DownloadIcon,
    ErrorOutline as ErrorIcon,
    TrendingUp as TrendingIcon,
    SortByAlpha as SortIcon
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { reportService } from '../services/reportService';
import { carteraService } from '../services/carteraService';

const ReportesOperativos = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Estado del Tab
    const [tabIndex, setTabIndex] = useState(0);

    // Filtros
    const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [carteraId, setCarteraId] = useState('');
    const [carteras, setCarteras] = useState([]);

    // Sorting
    const [orderBy, setOrderBy] = useState('fecha');
    const [order, setOrder] = useState('desc');

    // Data
    const [kpis, setKpis] = useState(null);
    const [morosidadData, setMorosidadData] = useState([]);
    const [movimientosData, setMovimientosData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCarteras();
    }, []);

    useEffect(() => {
        loadReportData();
    }, [fechaInicio, fechaFin, carteraId, tabIndex]);

    const loadCarteras = async () => {
        try {
            const data = await carteraService.getCarteras(user.rol === 'admin' ? user.id : null);
            setCarteras(data);
        } catch (error) {
            console.error('Error loading carteras:', error);
        }
    };

    const handlePreset = (type) => {
        const today = new Date();
        if (type === 'today') {
            setFechaInicio(format(today, 'yyyy-MM-dd'));
            setFechaFin(format(today, 'yyyy-MM-dd'));
        } else if (type === 'week') {
            setFechaInicio(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
            setFechaFin(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        } else if (type === 'month') {
            setFechaInicio(format(startOfMonth(today), 'yyyy-MM-dd'));
            setFechaFin(format(endOfMonth(today), 'yyyy-MM-dd'));
        }
    };

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const sortedMovimientos = useMemo(() => {
        return [...movimientosData].sort((a, b) => {
            let valA = a[orderBy];
            let valB = b[orderBy];

            // Handle dates
            if (orderBy === 'fecha') {
                valA = new Date(a.fecha).getTime();
                valB = new Date(b.fecha).getTime();
            }
            // Handle numbers
            if (orderBy === 'monto') {
                valA = parseFloat(a.monto);
                valB = parseFloat(b.monto);
            }
            // Handle strings
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valB < valA) {
                return order === 'asc' ? 1 : -1;
            }
            if (valB > valA) {
                return order === 'asc' ? -1 : 1;
            }
            return 0;
        });
    }, [movimientosData, order, orderBy]);

    const loadReportData = async () => {
        setLoading(true);
        try {
            const selectedCartera = carteraId === 'todas' ? null : carteraId || null;
            let adminId = user.rol === 'admin' ? user.id : null;
            let encargadoId = user.rol === 'encargado' ? user.id : null;

            if (tabIndex === 0) {
                // Resumen / Dashboard + Movimientos
                const [kpiData, movimientos] = await Promise.all([
                    reportService.getFinancialKPIs(fechaInicio, fechaFin, selectedCartera, adminId, encargadoId),
                    reportService.getDetailedMovements(fechaInicio, fechaFin, selectedCartera, adminId, encargadoId)
                ]);
                setKpis(kpiData);
                setMovimientosData(movimientos || []);
            } else if (tabIndex === 1) {
                // Morosidad Detallada
                const data = await reportService.getDetailedMorosidad(selectedCartera, adminId, encargadoId);
                setMorosidadData(data || []);
            }
        } catch (error) {
            showToast('Error cargando reportes', 'error');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        let exportData = [];
        let fileName = '';
        let headers = [];

        if (tabIndex === 1) {
            exportData = morosidadData;
            fileName = `Reporte_Morosidad_${format(new Date(), 'yyyyMMdd')}.csv`;
            headers = ['Código Préstamo', 'Cliente', 'Móvil', 'Cartera', 'Capital Pendiente', 'Interés Pendiente', 'Saldo Total', 'Días Atraso'];
        } else {
            // En Resumen, exportamos los movimientos detallados ordenados
            exportData = sortedMovimientos;
            fileName = `Reporte_Movimientos_${format(new Date(), 'yyyyMMdd')}.csv`;
            headers = ['Fecha/Hora', 'Fecha', 'Tipo', 'Monto', 'Código Préstamo', 'Cliente', 'Cartera'];
        }

        if (!exportData || exportData.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }

        // Convert to CSV
        const csvContent = [
            headers.join(','),
            ...exportData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    const renderKPICard = (title, value, color, subtitle = '') => (
        <Card sx={{ height: '100%', borderRadius: '16px', borderLeft: `5px solid ${color}`, boxShadow: '0 2px 10px 0 rgba(0,0,0,0.05)' }}>
            <CardContent>
                <Typography color="text.secondary" gutterBottom variant="overline" sx={{ fontWeight: 'bold' }}>
                    {title}
                </Typography>
                <Typography variant="h5" component="div" fontWeight="bold" sx={{ color: color }}>
                    {typeof value === 'number' ? formatCurrency(value) : value}
                </Typography>
                {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
            </CardContent>
        </Card>
    );

    /**
     * Devuelve el color MUI del chip según el tipo de movimiento.
     * Recaudo = success (verde), Desembolso = info (azul), Retiro Utilidad = warning (naranja)
     */
    const getMovimientoColor = (tipo) => {
        if (tipo === 'Recaudo') return 'success';
        if (tipo === 'Retiro Utilidad') return 'warning';
        return 'info';
    };

    const renderMobileCard = (row) => (
        <Card key={row.id || Math.random()} sx={{ mb: 2, borderRadius: '16px', borderLeft: `4px solid ${row.tipo === 'Recaudo' ? theme.palette.success.main : row.tipo === 'Retiro Utilidad' ? theme.palette.warning.main : theme.palette.info.main}`, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                        <Typography variant="subtitle2" fontWeight="bold">{row.cliente_nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.cartera_nombre}</Typography>
                    </Box>
                    <Chip
                        label={row.tipo}
                        size="small"
                        color={getMovimientoColor(row.tipo)}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="caption" display="block" color="text.secondary">Fecha</Typography>
                        <Typography variant="body2">{format(new Date(row.fecha), 'dd/MM/yyyy')}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" display="block" color="text.secondary">Préstamo</Typography>
                        <Typography variant="body2">{row.codigo_prestamo}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" display="block" color="text.secondary">Monto</Typography>
                        <Typography variant="body1" fontWeight="bold" color={row.tipo === 'Recaudo' ? 'success.main' : row.tipo === 'Retiro Utilidad' ? 'warning.main' : 'info.main'}>
                            {row.tipo === 'Recaudo' ? '+' : '-'} {formatCurrency(row.monto)}
                        </Typography>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{ p: isMobile ? 2 : 3 }}>
            {/* Header y Filtros */}
            <Paper sx={{ p: isMobile ? 2 : 3, mb: 3, borderRadius: '16px', boxShadow: '0 2px 10px 0 rgba(0,0,0,0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                    <div>
                        <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                            Reportes Operativos
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip label="Hoy" size="small" onClick={() => handlePreset('today')} variant="outlined" sx={{ cursor: 'pointer' }} />
                            <Chip label="Esta Semana" size="small" onClick={() => handlePreset('week')} variant="outlined" sx={{ cursor: 'pointer' }} />
                            <Chip label="Este Mes" size="small" onClick={() => handlePreset('month')} variant="outlined" sx={{ cursor: 'pointer' }} />
                        </Box>
                    </div>

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
                        <TextField
                            select
                            label="Cartera"
                            size="small"
                            value={carteraId}
                            onChange={(e) => setCarteraId(e.target.value)}
                            sx={{ minWidth: isMobile ? '100%' : 200 }}
                        >
                            <MenuItem value=""><em>Todas las Carteras</em></MenuItem>
                            {carteras.map((c) => (
                                <MenuItem key={c.id} value={c.id}>{c.nombre} ({c.codigo})</MenuItem>
                            ))}
                        </TextField>
                        <Box sx={{ display: 'flex', gap: 1, width: isMobile ? '100%' : 'auto' }}>
                            <TextField
                                type="date"
                                label="Desde"
                                size="small"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ flexGrow: 1 }}
                            />
                            <TextField
                                type="date"
                                label="Hasta"
                                size="small"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ flexGrow: 1 }}
                            />
                        </Box>
                        <MuiTooltip title={tabIndex === 0 ? "Descargar reporte de movimientos" : "Descargar reporte de morosidad"}>
                            <span>
                                <Button
                                    variant="contained"
                                    startIcon={<DownloadIcon />}
                                    onClick={handleExport}
                                    color="secondary"
                                    disabled={loading}
                                    fullWidth={isMobile}
                                >
                                    Exportar
                                </Button>
                            </span>
                        </MuiTooltip>
                    </Box>
                </Box>

                <Tabs
                    value={tabIndex}
                    onChange={(e, v) => setTabIndex(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                    variant={isMobile ? "fullWidth" : "standard"}
                >
                    <Tab icon={<TrendingIcon />} label={isMobile ? "Resumen" : "Resumen General"} iconPosition="start" />
                    <Tab icon={<ErrorIcon />} label={isMobile ? "Morosidad" : "Morosidad Detallada"} iconPosition="start" />
                </Tabs>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* TAB 0: DASHBOARD + MOVIMIENTOS TABLE */}
                    {tabIndex === 0 && (
                        <>
                            <Grid container spacing={2} sx={{ mb: 4 }}>
                                <Grid item xs={12} sm={6} md={2}>
                                    {renderKPICard('Capital Prestado', kpis?.total_prestado || 0, '#2196F3', 'Total desembolsado')}
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    {renderKPICard('Total Recaudado', kpis?.total_recaudado || 0, '#4CAF50', 'Total recaudado')}
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    {renderKPICard('Ganancia Bruta', kpis?.ganancia_bruta || 0, '#FFC107', 'Intereses cobrados')}
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    {/* Retiros de rentabilidad del periodo — impacta la ganancia neta */}
                                    {renderKPICard('Total Retirado', kpis?.total_retirado || 0, '#FF5722', 'Retiros de rentabilidad')}
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    {/* Ganancia neta = intereses cobrados menos retiros ya ejecutados */}
                                    {renderKPICard('Ganancia Neta', kpis?.ganancia_neta || 0, '#009688', 'Disponible sin retirar')}
                                </Grid>
                                <Grid item xs={12} sm={6} md={2}>
                                    {renderKPICard('Índice de Mora', `${kpis?.indice_mora || 0}%`, '#F44336', '% cartera vencida')}
                                </Grid>
                            </Grid>

                            {/* MOVIMIENTOS SECTION */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 2 }}>
                                <Typography variant="h6" fontWeight="bold">
                                    Movimientos del Periodo
                                </Typography>
                                {isMobile && (
                                    <Button
                                        size="small"
                                        startIcon={<SortIcon />}
                                        onClick={() => handleRequestSort('fecha')}
                                    >
                                        {orderBy === 'fecha' && order === 'desc' ? 'Más Recientes' : 'Más Antiguos'}
                                    </Button>
                                )}
                            </Box>

                            {sortedMovimientos.length > 0 ? (
                                isMobile ? (
                                    <Box>
                                        {sortedMovimientos.map((row, idx) => renderMobileCard(row))}
                                    </Box>
                                ) : (
                                    <TableContainer component={Paper} sx={{ borderRadius: '16px', boxShadow: '0 2px 10px 0 rgba(0,0,0,0.05)' }}>
                                        <Table>
                                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'fecha'}
                                                            direction={orderBy === 'fecha' ? order : 'asc'}
                                                            onClick={() => handleRequestSort('fecha')}
                                                        >
                                                            Fecha
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>Préstamo</TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'cliente_nombre'}
                                                            direction={orderBy === 'cliente_nombre' ? order : 'asc'}
                                                            onClick={() => handleRequestSort('cliente_nombre')}
                                                        >
                                                            Cliente
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>Cartera</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'monto'}
                                                            direction={orderBy === 'monto' ? order : 'asc'}
                                                            onClick={() => handleRequestSort('monto')}
                                                        >
                                                            Monto
                                                        </TableSortLabel>
                                                    </TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {sortedMovimientos.map((row, idx) => (
                                                    <TableRow key={idx} hover>
                                                        <TableCell>{format(new Date(row.fecha), 'dd/MM/yyyy')}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={row.tipo}
                                                                color={getMovimientoColor(row.tipo)}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        </TableCell>
                                                        <TableCell><Chip label={row.codigo_prestamo} size="small" /></TableCell>
                                                        <TableCell>{row.cliente_nombre}</TableCell>
                                                        <TableCell>{row.cartera_nombre}</TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2" fontWeight="bold" color={row.tipo === 'Recaudo' ? 'success.main' : row.tipo === 'Retiro Utilidad' ? 'warning.main' : 'info.main'}>
                                                                {row.tipo === 'Recaudo' ? '+' : '-'} {formatCurrency(row.monto)}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )
                            ) : (
                                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '16px' }}>
                                    <Typography color="text.secondary">No hay movimientos registrados en este periodo.</Typography>
                                </Paper>
                            )}
                        </>
                    )}

                    {/* TAB 1: MOROSIDAD DETALLADA */}
                    {tabIndex === 1 && (
                        <TableContainer component={Paper} sx={{ borderRadius: '16px', boxShadow: '0 2px 10px 0 rgba(0,0,0,0.05)' }}>
                            <Table>
                                <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Cliente</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Préstamo</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Cartera</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>C. Pendiente</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>I. Pendiente</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Adeudado</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Días Mora</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {morosidadData.length > 0 ? morosidadData.map((row) => (
                                        <TableRow key={row.codigo_prestamo} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{row.cliente_nombre}</Typography>
                                                <Typography variant="caption" color="text.secondary">{row.cliente_movil}</Typography>
                                            </TableCell>
                                            <TableCell><Chip label={row.codigo_prestamo} size="small" variant="outlined" /></TableCell>
                                            <TableCell>{row.cartera_nombre}</TableCell>
                                            <TableCell align="right">{formatCurrency(row.capital_pendiente)}</TableCell>
                                            <TableCell align="right">{formatCurrency(row.interes_pendiente)}</TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight="bold" color="error">
                                                    {formatCurrency(row.saldo_total)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={`${row.dias_atraso} días`}
                                                    color={row.dias_atraso > 30 ? "error" : "warning"}
                                                    size="small"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                                No hay registros de morosidad para los filtros aplicados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}
        </Box>
    );
};

export default ReportesOperativos;
