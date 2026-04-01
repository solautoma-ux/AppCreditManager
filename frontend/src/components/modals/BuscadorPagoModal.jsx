import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, TextField, InputAdornment,
    List, ListItem, ListItemText, ListItemSecondaryAction,
    Chip, Divider, IconButton, CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import PersonIcon from '@mui/icons-material/Person';
import PaymentIcon from '@mui/icons-material/Payment';

import { creditoService } from '../../services/creditoService';
import { useAuth } from '../../context/AuthContext';

const BuscadorPagoModal = ({ open, onClose, onSelectCredito }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (open && searchTerm.length >= 2) {
                handleSearch();
            } else if (searchTerm.length < 2) {
                setResults([]);
                setHasSearched(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, open]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const data = await creditoService.buscarCreditosPorCliente(searchTerm);
            setResults(data || []);
            setHasSearched(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

    const handleSelect = (credito) => {
        onSelectCredito(credito);
        onClose(); // Close search modal
        setSearchTerm(''); // Reset
        setResults([]);
    };

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: '16px', minHeight: '50vh' } }}
        >
            <DialogTitle sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight="bold">Buscar Cliente a Pagar</Typography>
                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 2 }}>
                <Box sx={{ mb: 3 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        placeholder="Nombre, Apellido o Cédula..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: '12px' }
                        }}
                        helperText="Escribe al menos 2 letras para buscar"
                    />
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <List sx={{ pt: 0 }}>
                        {results.length > 0 ? (
                            results.map((credito) => (
                                <React.Fragment key={credito.id}>
                                    <ListItem
                                        button
                                        onClick={() => handleSelect(credito)}
                                        sx={{
                                            mb: 1,
                                            borderRadius: '12px',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' }
                                        }}
                                    >
                                        <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.dark' }}>
                                            <PersonIcon />
                                        </Box>
                                        <ListItemText
                                            primary={
                                                <Typography variant="subtitle2" fontWeight="bold">
                                                    {credito.cliente.nombre} {credito.cliente.apellido}
                                                </Typography>
                                            }
                                            secondary={
                                                <Box sx={{ mt: 0.5 }}>
                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                        CC: {credito.cliente.cedula} • {credito.cartera?.nombre}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                        <Chip
                                                            label={credito.estado.toUpperCase()}
                                                            size="small"
                                                            color={credito.estado === 'activo' ? 'success' : 'error'}
                                                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }}
                                                        />
                                                        <Typography variant="caption" fontWeight="bold">
                                                            Deuda: {formatCurrency(credito.saldo_capital_pendiente + credito.saldo_interes_pendiente)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<PaymentIcon />}
                                                onClick={() => handleSelect(credito)}
                                                sx={{ borderRadius: '8px', textTransform: 'none' }}
                                            >
                                                Cobrar
                                            </Button>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                </React.Fragment>
                            ))
                        ) : hasSearched && searchTerm.length >= 2 ? (
                            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                                <Typography variant="body2">No se encontraron créditos activos o vencidos.</Typography>
                            </Box>
                        ) : (
                            !hasSearched && (
                                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary', opacity: 0.7 }}>
                                    <SearchIcon sx={{ fontSize: 48, mb: 1 }} />
                                    <Typography variant="body2">Busca un cliente para registrar un pago.</Typography>
                                </Box>
                            )
                        )}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default BuscadorPagoModal;
