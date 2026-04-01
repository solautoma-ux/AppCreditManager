import React from 'react';
import { Box, IconButton, Avatar, Typography } from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNoneRounded';
import Sidebar from './common/Sidebar';
import { useAuth } from '../context/AuthContext';
import MenuIcon from '@mui/icons-material/MenuRounded';

const Layout = ({ children }) => {
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = React.useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
            <Sidebar mobileOpen={mobileOpen} onClose={handleDrawerToggle} />

            <Box sx={{
                flexGrow: 1,
                p: 3,
                transition: 'margin 0.2s ease-in-out'
            }}>
                {/* Header responsive */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {/* Botón Menú (Solo móvil) */}
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2, display: { md: 'none' }, bgcolor: 'background.paper' }}
                        >
                            <MenuIcon />
                        </IconButton>

                        <Box>
                            {/* Título o breadcrumb opcional */}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton sx={{ bgcolor: 'background.paper', color: 'primary.main', '&:hover': { bgcolor: 'action.hover' } }}>
                            <NotificationsNoneIcon />
                        </IconButton>

                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            p: 0.5,
                            pr: 2,
                            pl: 0.5,
                            borderRadius: 50,
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}>
                            <Avatar src={user?.user_metadata?.avatar_url} sx={{ width: 32, height: 32, bgcolor: 'primary.dark' }} />
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ display: { xs: 'none', sm: 'block' } }}>
                                {user?.user_metadata?.full_name || 'Usuario'}
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {children}
            </Box>
        </Box>
    );
};

export default Layout;
