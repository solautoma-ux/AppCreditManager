import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, MenuItem, Chip, IconButton, Tooltip,
    CircularProgress, Alert, Pagination, InputAdornment, TableSortLabel, TablePagination
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import PersonIcon from '@mui/icons-material/PersonRounded';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { auditService } from '../services/auditService';
import { useAuth } from '../context/AuthContext';

/**
 * Página de Registro de Actividades (Solo Super Admin)
 * Muestra un historial de todas las acciones realizadas en el sistema.
 */
const RegistroActividades = () => {
    // Auth context para filtrado por rol
    const { user } = useAuth();
    const bol_isSuperAdmin = user?.rol === 'super_admin';
    // Admin pasa su ID para filtrar, Super Admin pasa null para ver todo
    const str_adminIdFilter = bol_isSuperAdmin ? null : user?.id;

    // State
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0); // Changed to 0-indexed for MUI Pagination
    const [rowsPerPage] = useState(25); // Renamed from int_logsPerPage

    // Filtros
    const [filters, setFilters] = useState({
        usuarioId: '',
        accion: '',
        tabla: '',
        fechaDesde: '',
        fechaHasta: ''
    });

    // Ordenamiento
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('created_at');

    const [usuarios, setUsuarios] = useState([]);
    const [tablas, setTablas] = useState([]);

    // Cargar filtros iniciales
    useEffect(() => {
        const loadFilterOptions = async () => {
            const [usersData, tablasData] = await Promise.all([
                auditService.getUsuariosConActividad(str_adminIdFilter),
                auditService.getTablasAfectadas()
            ]);
            setUsuarios(usersData);
            setTablas(tablasData);
        };
        loadFilterOptions();
    }, [str_adminIdFilter]);

    // Cargar logs
    useEffect(() => {
        fetchLogs();
    }, [page, filters, order, orderBy]); // Recargar al cambiar filtros o sort

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const offset = page * rowsPerPage;
            const { data, total: totalCount } = await auditService.getActivityLogs(
                filters,
                rowsPerPage,
                offset,
                str_adminIdFilter,
                { orderBy, order }
            );
            setLogs(data);
            setTotal(totalCount);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Color de chip según acción
    const getAccionColor = (accion) => {
        switch (accion) {
            case 'crear': return 'success';
            case 'actualizar': return 'info';
            case 'eliminar': return 'error';
            case 'habilitar': return 'success';
            case 'inhabilitar': return 'warning';
            case 'retiro': return 'secondary';
            default: return 'default';
        }
    };

    // Obtener ID legible (Código, Cédula, etc)
    const getReadableId = (log) => {
        // 1. Si el RPC devolvió el código vivo (JOIN exitoso), usarlo
        if (log.entidad_codigo) return log.entidad_codigo;

        // 2. Fallback: Parsear JSON si la entidad fue borrada o no se encontró
        try {
            // Usar valor_nuevo para crear/actualizar, valor_anterior para eliminar
            const jsonStr = log.accion === 'eliminar' ? log.valor_anterior : log.valor_nuevo;
            if (!jsonStr) return log.registro_id?.substring(0, 8);

            const data = JSON.parse(jsonStr);

            switch (log.tabla_afectada) {
                case 'carteras':
                    return data.codigo || log.registro_id?.substring(0, 8);
                case 'creditos':
                    return data.codigo || log.registro_id?.substring(0, 8);
                case 'clientes':
                    return data.cedula || log.registro_id?.substring(0, 8);
                case 'usuarios':
                    return data.cedula || data.email || log.registro_id?.substring(0, 8);
                default:
                    return log.registro_id?.substring(0, 8);
            }
        } catch (e) {
            return log.registro_id?.substring(0, 8);
        }
    };

    // Nombre amigable de tabla
    const getTablaLabel = (tabla) => {
        const labels = {
            'carteras': 'Cartera',
            'clientes': 'Cliente',
            'creditos': 'Préstamo',
            'pagos': 'Pago',
            'usuarios': 'Usuario',
            'cartera_encargados': 'Asignación Cartera',
            'amortizaciones': 'Cuota'
        };
        return labels[tabla] || tabla;
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPage(0); // Reset a primera página al filtrar
    };

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
        setPage(0); // Volver a primera página al ordenar
    };

    const totalPages = Math.ceil(total / rowsPerPage);

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">
                        <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        {bol_isSuperAdmin ? 'Registro de Actividades' : 'Mi Actividad'}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {bol_isSuperAdmin
                            ? 'Historial completo de acciones en el sistema'
                            : 'Historial de acciones tuyas y de tus encargados'
                        }
                    </Typography>
                </Box>
                <Tooltip title="Refrescar">
                    <IconButton onClick={fetchLogs} color="primary">
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Filtros */}
            <Paper sx={{ p: 2, borderRadius: '16px', mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                        select
                        label="Usuario"
                        size="small"
                        value={filters.usuarioId}
                        onChange={(e) => handleFilterChange('usuarioId', e.target.value)}
                        sx={{ minWidth: 180 }}
                    >
                        <MenuItem value="">Todos</MenuItem>
                        {usuarios.map(u => (
                            <MenuItem key={u.id} value={u.id}>
                                {u.nombre} {u.apellido}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Acción"
                        size="small"
                        value={filters.accion}
                        onChange={(e) => handleFilterChange('accion', e.target.value)}
                        sx={{ minWidth: 140 }}
                    >
                        <MenuItem value="">Todas</MenuItem>
                        {auditService.getAcciones().map(a => (
                            <MenuItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Entidad"
                        size="small"
                        value={filters.tabla}
                        onChange={(e) => handleFilterChange('tabla', e.target.value)}
                        sx={{ minWidth: 140 }}
                    >
                        <MenuItem value="">Todas</MenuItem>
                        {tablas.map(t => (
                            <MenuItem key={t} value={t}>{getTablaLabel(t)}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        type="date"
                        label="Desde"
                        size="small"
                        value={filters.fechaDesde}
                        onChange={(e) => handleFilterChange('fechaDesde', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        type="date"
                        label="Hasta"
                        size="small"
                        value={filters.fechaHasta}
                        onChange={(e) => handleFilterChange('fechaHasta', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                </Box>
            </Paper>

            {/* Tabla de Logs */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <>
                    <TableContainer component={Paper} sx={{ borderRadius: '16px' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    {[
                                        { id: 'created_at', label: 'Fecha/Hora' },
                                        { id: 'usuario_id', label: 'Usuario' }, // Changed to match backend field
                                        { id: 'accion', label: 'Acción' },
                                        { id: 'tabla_afectada', label: 'Entidad' }, // Changed to match backend field
                                        { id: 'registro_id', label: 'Código' }, // Changed to match backend field
                                        { id: 'campo_modificado', label: 'Campo' }, // Changed to match backend field
                                        { id: 'valor_anterior', label: 'Valor Anterior' },
                                        { id: 'valor_nuevo', label: 'Valor Nuevo' }
                                    ].map((headCell) => (
                                        <TableCell
                                            key={headCell.id}
                                            sx={{ fontWeight: 'bold' }}
                                            sortDirection={orderBy === headCell.id ? order : false}
                                        >
                                            <TableSortLabel
                                                active={orderBy === headCell.id}
                                                direction={orderBy === headCell.id ? order : 'asc'}
                                                onClick={() => handleRequestSort(headCell.id)}
                                            >
                                                {headCell.label}
                                            </TableSortLabel>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.map((log) => {
                                    const readableId = getReadableId(log);
                                    return (
                                        <TableRow key={log.id} hover>
                                            <TableCell>
                                                <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                                                    {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <PersonIcon fontSize="small" color="action" />
                                                    <Typography variant="body2">
                                                        {log.usuario ? `${log.usuario.nombre} ${log.usuario.apellido}` : 'Sistema'}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={log.accion}
                                                    size="small"
                                                    color={getAccionColor(log.accion)}
                                                    sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={getTablaLabel(log.tabla_afectada)}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={`ID: ${log.registro_id}`}>
                                                    <Typography variant="body2" fontWeight="medium" color="primary">
                                                        {readableId}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {log.campo_modificado || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={log.valor_anterior || ''}>
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        sx={{ maxWidth: 150, color: 'error.main' }}
                                                    >
                                                        {log.accion === 'retiro' && log.valor_anterior ? (
                                                            new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(log.valor_anterior) || 0)
                                                        ) : log.valor_anterior ? (
                                                            log.valor_anterior.length > 30
                                                                ? log.valor_anterior.substring(0, 30) + '...'
                                                                : log.valor_anterior
                                                        ) : '-'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                {log.accion === 'crear' ? (
                                                    log.tabla_afectada === 'pagos' ? (
                                                        <Typography variant="body2" color="success.main" fontWeight="bold">
                                                            {(() => {
                                                                try {
                                                                    const data = JSON.parse(log.valor_nuevo);
                                                                    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(data.monto_total);
                                                                } catch (e) { return '-'; }
                                                            })()}
                                                        </Typography>
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">-</Typography>
                                                    )
                                                ) : (
                                                    <Tooltip title={log.valor_nuevo || ''}>
                                                        <Typography
                                                            variant="body2"
                                                            noWrap
                                                            sx={{ maxWidth: 150, color: 'success.main' }}
                                                        >
                                                            {log.accion === 'retiro' && log.valor_nuevo ? (
                                                                new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(log.valor_nuevo) || 0)
                                                            ) : log.valor_nuevo ? (
                                                                log.valor_nuevo.length > 30
                                                                    ? log.valor_nuevo.substring(0, 30) + '...'
                                                                    : log.valor_nuevo
                                                            ) : '-'}
                                                        </Typography>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {logs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                            <Typography color="text.secondary">
                                                No se encontraron registros con los filtros seleccionados.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        rowsPerPageOptions={[10, 20, 50, 100]}
                        component="div"
                        count={total}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(event, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(parseInt(event.target.value, 10));
                            setPage(0);
                        }}
                        labelRowsPerPage="Filas por página:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`}
                        sx={{ borderTop: '1px solid rgba(224, 224, 224, 1)' }}
                    />
                </>
            )}
        </Box>
    );
};

export default RegistroActividades;
