import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';

/**
 * Reusable Confirmation Dialog component.
 * Replaces native window.confirm() with a styled Material-UI dialog.
 * 
 * @param {boolean} open - Controls dialog visibility
 * @param {function} onClose - Called when dialog is dismissed (cancel/backdrop click)
 * @param {function} onConfirm - Called when user confirms the action
 * @param {string} title - Dialog title
 * @param {string} message - Main message/description
 * @param {string} confirmText - Text for the confirm button (default: "Confirmar")
 * @param {string} cancelText - Text for the cancel button (default: "Cancelar")
 * @param {string} severity - Icon style: 'warning' | 'info' | 'success' | 'error' (default: 'warning')
 * @param {boolean} loading - Shows loading state on confirm button
 */
const ConfirmDialog = ({
    open,
    onClose,
    onConfirm,
    title = "¿Está seguro?",
    message = "Esta acción no se puede deshacer.",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    severity = "warning",
    loading = false
}) => {
    // Select icon based on severity
    const getIcon = () => {
        const iconProps = { sx: { fontSize: 48 } };
        switch (severity) {
            case 'info':
                return <InfoOutlinedIcon {...iconProps} color="info" />;
            case 'success':
                return <CheckCircleOutlineRoundedIcon {...iconProps} color="success" />;
            case 'error':
                return <ErrorOutlineRoundedIcon {...iconProps} color="error" />;
            case 'warning':
            default:
                return <WarningAmberRoundedIcon {...iconProps} color="warning" />;
        }
    };

    // Select confirm button color based on severity
    const getButtonColor = () => {
        switch (severity) {
            case 'info': return 'info';
            case 'success': return 'success';
            case 'error': return 'error';
            case 'warning':
            default: return 'warning';
        }
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{ sx: { borderRadius: '12px', textAlign: 'center' } }}
        >
            <DialogTitle sx={{ pt: 4, pb: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    {getIcon()}
                    <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>
                        {title}
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Typography variant="body2" color="text.secondary">
                    {message}
                </Typography>
            </DialogContent>

            <DialogActions sx={{ p: 2, justifyContent: 'center', gap: 1 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    color="inherit"
                    disabled={loading}
                    sx={{ borderRadius: '8px', minWidth: 100 }}
                >
                    {cancelText}
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color={getButtonColor()}
                    disabled={loading}
                    sx={{ borderRadius: '8px', minWidth: 100 }}
                >
                    {loading ? 'Procesando...' : confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
