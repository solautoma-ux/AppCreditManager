import { createTheme } from '@mui/material/styles';

const getTheme = (mode) => createTheme({
    palette: {
        mode,
        primary: {
            // Azul suave pero vibrante (Soft Blue)
            main: mode === 'dark' ? '#60A5FA' : '#3B82F6',
            light: '#93C5FD',
            dark: '#2563EB',
            contrastText: '#fff',
        },
        secondary: {
            main: '#10B981', // Verde
            light: '#34D399',
            dark: '#059669',
            contrastText: '#fff',
        },
        background: {
            default: mode === 'dark' ? '#0F172A' : '#F3F4F6', // Dark: Slate 900
            paper: mode === 'dark' ? '#1E293B' : '#FFFFFF',   // Dark: Slate 800
        },
        text: {
            primary: mode === 'dark' ? '#F1F5F9' : '#1F2937',
            secondary: mode === 'dark' ? '#94A3B8' : '#6B7280',
        },
    },
    typography: {
        fontFamily: '"Poppins", "Inter", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 600 },
        h2: { fontWeight: 600 },
        h3: { fontWeight: 600 },
        h4: { fontWeight: 600 },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        button: { textTransform: 'none', fontWeight: 500 },
    },
    shape: {
        borderRadius: 24, // Bordes redondeados consistentes
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 24,
                    padding: '10px 24px',
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', // Sombra azulada
                    },
                },
                containedPrimary: {
                    // Degradado azul suave
                    background: mode === 'dark'
                        ? 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)'
                        : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                }
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none', // Quitar overlay en dark mode
                    boxShadow: mode === 'dark'
                        ? '0 4px 20px rgba(0, 0, 0, 0.4)'
                        : '0 4px 20px rgba(0, 0, 0, 0.05)',
                },
                rounded: {
                    borderRadius: 24,
                }
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 24,
                    border: 'none',
                    boxShadow: mode === 'dark'
                        ? '0 4px 20px rgba(0, 0, 0, 0.4)'
                        : '0 4px 20px rgba(0, 0, 0, 0.05)',
                }
            }
        }
    },
});

export default getTheme;
