import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Alert,
    CircularProgress, Divider
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';

/**
 * ConfiguracionAdmin.jsx
 * Página de configuración exclusiva para el rol 'admin'.
 * Permite configurar el mensaje personalizado de WhatsApp.
 */
const ConfiguracionAdmin = () => {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();

    // Estado del mensaje personalizado
    const [str_mensajeWhatsapp, setStr_mensajeWhatsapp] = useState('');
    const [bol_loading, setBol_loading] = useState(false);
    const [bol_initialLoading, setBol_initialLoading] = useState(true);

    // Solo admin puede ver esta página
    if (user?.rol !== 'admin') {
        return <Alert severity="error">Acceso denegado. Solo Administradores pueden ver esta sección.</Alert>;
    }

    // Cargar mensaje existente al montar
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data, error } = await supabase
                    .from('usuarios')
                    .select('whatsapp_mensaje_custom')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                setStr_mensajeWhatsapp(data?.whatsapp_mensaje_custom || '');
            } catch (err) {
                console.error('Error loading config:', err);
            } finally {
                setBol_initialLoading(false);
            }
        };

        if (user?.id) fetchConfig();
    }, [user?.id]);

    // Guardar mensaje
    const handleSave = async () => {
        setBol_loading(true);
        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ whatsapp_mensaje_custom: str_mensajeWhatsapp || null })
                .eq('id', user.id);

            if (error) throw error;

            // Refresh user context to get updated whatsapp_mensaje_custom
            await refreshUser();

            showToast('Mensaje de WhatsApp guardado correctamente', 'success');
        } catch (err) {
            console.error('Error saving config:', err);
            showToast('Error al guardar: ' + err.message, 'error');
        } finally {
            setBol_loading(false);
        }
    };

    if (bol_initialLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box maxWidth="md" sx={{ mx: 'auto', mt: 4 }}>
            {/* Encabezado */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <SettingsRoundedIcon color="primary" />
                <Typography variant="h4" fontWeight="bold">
                    Configuración
                </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" paragraph>
                Personaliza las opciones de tu cuenta de administrador.
            </Typography>

            {/* Sección WhatsApp */}
            <Paper
                elevation={0}
                sx={{
                    p: 4,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: 'success.light',
                    bgcolor: 'success.lighter'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <WhatsAppIcon color="success" />
                    <Typography variant="h6" fontWeight="bold" color="success.main">
                        Mensaje de WhatsApp
                    </Typography>
                </Box>
                <Divider sx={{ mb: 3, borderColor: 'success.light' }} />

                <Typography variant="body2" color="text.secondary" paragraph>
                    Configura un mensaje <strong>adicional</strong> que se agregará <strong>al final</strong> de las notificaciones de WhatsApp.
                </Typography>

                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                    <strong>No incluyas saludos</strong> como "Hola [nombre]" aquí. El sistema ya agrega automáticamente el saludo con el nombre del cliente.
                </Alert>

                <Typography variant="body2" color="text.secondary" paragraph>
                    <strong>Ejemplo:</strong> Si escribes "<em>Recuerda que puedes pagar en cualquiera de nuestras oficinas.</em>",
                    el mensaje final será: "Hola Juan, le recordamos el pago... <strong>Recuerda que puedes pagar en cualquiera de nuestras oficinas.</strong>"
                </Typography>

                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="Escribe aquí tu mensaje personalizado (opcional)"
                    value={str_mensajeWhatsapp}
                    onChange={(e) => setStr_mensajeWhatsapp(e.target.value)}
                    InputProps={{ sx: { borderRadius: 3, bgcolor: 'background.paper' } }}
                    sx={{ mb: 3 }}
                />

                <Button
                    variant="contained"
                    color="success"
                    startIcon={bol_loading ? <CircularProgress size={20} color="inherit" /> : <SaveRoundedIcon />}
                    onClick={handleSave}
                    disabled={bol_loading}
                    sx={{ borderRadius: 3, px: 4 }}
                >
                    {bol_loading ? 'Guardando...' : 'Guardar Mensaje'}
                </Button>
            </Paper>
        </Box>
    );
};

export default ConfiguracionAdmin;
