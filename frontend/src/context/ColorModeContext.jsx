import React, { createContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import getTheme from '../theme';

export const ColorModeContext = createContext({ toggleColorMode: () => { } });

export const ColorModeProvider = ({ children }) => {
    const [mode, setMode] = useState('light');

    // Cargar preferencia guardada al iniciar
    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode');
        if (savedMode) {
            setMode(savedMode);
        } else {
            // Por defecto LIGHT como solicitado por el usuario
            setMode('light');
        }
    }, []);

    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => {
                    const newMode = prevMode === 'light' ? 'dark' : 'light';
                    localStorage.setItem('themeMode', newMode); // Persistencia local
                    return newMode;
                });
            },
            mode, // Exponer el modo actual
        }),
        [mode],
    );

    const theme = useMemo(() => getTheme(mode), [mode]);

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};
