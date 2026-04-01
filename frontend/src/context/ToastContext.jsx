import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, Slide } from '@mui/material';

/**
 * Toast Context for global toast notifications.
 * Use this to show success/error/info messages across the app.
 */
const ToastContext = createContext(null);

/**
 * Hook to access toast functionality.
 * @returns {{ showToast: Function }}
 */
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

/**
 * Slide transition for Snackbar.
 */
const SlideTransition = (props) => {
    return <Slide {...props} direction="up" />;
};

/**
 * Toast Provider component.
 * Wrap your app with this to enable global toast notifications.
 */
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({
        open: false,
        message: '',
        severity: 'success', // 'success' | 'error' | 'warning' | 'info'
        duration: 4000
    });

    /**
     * Shows a toast notification.
     * @param {string} message - The message to display
     * @param {'success'|'error'|'warning'|'info'} severity - Toast type (default: 'success')
     * @param {number} duration - Duration in ms (default: 4000)
     */
    const showToast = useCallback((message, severity = 'success', duration = 4000) => {
        setToast({
            open: true,
            message,
            severity,
            duration
        });
    }, []);

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') return;
        setToast(prev => ({ ...prev, open: false }));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <Snackbar
                open={toast.open}
                autoHideDuration={toast.duration}
                onClose={handleClose}
                TransitionComponent={SlideTransition}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleClose}
                    severity={toast.severity}
                    variant="filled"
                    sx={{
                        width: '100%',
                        borderRadius: '10px',
                        fontWeight: 'medium',
                        boxShadow: 3
                    }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
};

export default ToastProvider;
