import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, Typography, Paper, Container, Alert, Collapse } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const { user, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            navigate('/'); // Redirigir al Dashboard si ya está logueado
            return;
        }

        // DEBUG: Log completo para ver qué devuelve Supabase
        console.log('🔍 Login URL Debug:', {
            search: location.search,
            hash: location.hash,
            pathname: location.pathname
        });

        // Supabase puede devolver errores en query params (?error=...) o hash (#error=...)
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const queryParams = new URLSearchParams(location.search);

        // Buscar error_description en ambos lugares
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
        const errorCode = hashParams.get('error') || queryParams.get('error');

        if (errorDescription || errorCode) {
            console.error("Login Error Detected:", { errorCode, errorDescription });
            // Traducir mensaje genérico del trigger
            if (errorDescription?.includes('Acceso denegado') || errorDescription?.includes('Database error') || errorCode === 'server_error') {
                setError('⛔ Acceso restringido. Tu usuario no ha sido registrado por un administrador.');
            } else {
                setError(`Error de inicio de sesión: ${decodeURIComponent(errorDescription || errorCode || 'Desconocido')}`);
            }
        }
    }, [user, navigate, location]);

    const handleLogin = async () => {
        await signInWithGoogle();
    };

    const handleSwitchAccount = async () => {
        // Forzar selector de cuentas de Google
        await signInWithGoogle({
            queryParams: {
                prompt: 'select_account'
            }
        });
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' // Fondo suave
            }}
        >
            <Container maxWidth="xs">
                <Paper
                    elevation={3}
                    sx={{
                        p: 5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderRadius: 4,
                        textAlign: 'center'
                    }}
                >
                    {/* Logo Placeholder */}
                    <Box sx={{ width: 60, height: 60, bgcolor: 'primary.main', borderRadius: 3, mb: 3 }} />

                    <Typography component="h1" variant="h4" fontWeight="bold" gutterBottom>
                        Bienvenido
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                        Sistema de Control de Créditos
                    </Typography>

                    {/* Alerta de Error */}
                    <Collapse in={!!error}>
                        <Alert severity="error" sx={{ mb: 3, borderRadius: 2, textAlign: 'left' }}>
                            {error}
                        </Alert>
                    </Collapse>

                    <Button
                        fullWidth
                        variant="outlined"
                        size="large"
                        startIcon={<GoogleIcon />}
                        onClick={handleLogin}
                        sx={{
                            py: 1.5,
                            borderRadius: 3,
                            textTransform: 'none',
                            fontSize: '1rem',
                            fontWeight: 600,
                            mb: 2,
                            // Eliminar colores fijos para soportar Dark Mode nativo
                            // o usar colores explícitos que funcionen en ambos
                            borderColor: 'divider',
                            color: 'text.primary',
                            '&:hover': {
                                bgcolor: 'action.hover',
                                borderColor: 'text.primary'
                            }
                        }}
                    >
                        Continuar con Google
                    </Button>

                    <Button
                        fullWidth
                        size="medium"
                        onClick={handleSwitchAccount}
                        sx={{
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            color: 'text.secondary',
                            '&:hover': {
                                color: 'primary.main',
                                bgcolor: 'transparent'
                            }
                        }}
                    >
                        Iniciar sesión con otra cuenta
                    </Button>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 4 }}>
                        © 2026 Antigravity - Versión Segura
                    </Typography>
                </Paper>
            </Container>
        </Box>
    );
};

export default Login;
