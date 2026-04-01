import React from 'react';
import { Box, Typography, Button, Paper, Container } from '@mui/material';
import LockIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };

    return (
        <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paper
                elevation={3}
                sx={{
                    p: 5,
                    borderRadius: 4,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                }}
            >
                <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: '50%', color: 'error.main', mb: 1 }}>
                    <LockIcon sx={{ fontSize: 40 }} />
                </Box>

                <Typography variant="h4" fontWeight="bold">
                    Acceso Denegado
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Hola <strong>{user?.email}</strong>. Tu cuenta de Google está autenticada, pero no tienes una invitación activa en el sistema.
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Por favor contacta al administrador para que te envíe una invitación o verifique tu acceso.
                </Typography>

                {/* DEBUG INFO - REMOVE IN PRODUCTION */}
                <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 2, fontSize: '10px', fontFamily: 'monospace', textAlign: 'left', width: '100%' }}>
                    <strong>Debug Info:</strong><br />
                    Email: {user?.email}<br />
                    Auth ID: {user?.id}<br />
                    Registered: {user?.is_registered ? 'Yes' : 'No'}<br />
                    Role: {user?.rol || 'None'}
                </Box>

                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleLogout}
                    disableElevation
                    sx={{ borderRadius: 24, px: 4 }}
                >
                    Cerrar Sesión / Intentar con otra cuenta
                </Button>
            </Paper>
        </Container>
    );
};

export default Unauthorized;
