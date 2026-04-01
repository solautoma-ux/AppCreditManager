import React, { useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Avatar,
    Divider,
    Paper,
    Switch,
    Drawer,
    Collapse,
    IconButton,
    useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
// Iconos comunes
import DashboardIcon from '@mui/icons-material/DashboardRounded';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import DarkModeIcon from '@mui/icons-material/DarkModeRounded';
import LightModeIcon from '@mui/icons-material/wbSunnyRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessIcon from '@mui/icons-material/ExpandLessRounded';
// Iconos Super Admin
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongRounded';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import SettingsIcon from '@mui/icons-material/SettingsRounded';
// Iconos Admin/Encargado
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PeopleIcon from '@mui/icons-material/PeopleRounded';
import AssessmentIcon from '@mui/icons-material/AssessmentRounded';
import CreditCardIcon from '@mui/icons-material/CreditCardRounded';
import GroupsIcon from '@mui/icons-material/GroupsRounded';
import { ColorModeContext } from '../../context/ColorModeContext';
import { useAuth } from '../../context/AuthContext';

// Definición de menús por rol según ux_ui_design.md líneas 341-386
const menuItemsByRole = {
    super_admin: [
        { label: 'Suscripciones', icon: <ReceiptLongIcon />, path: '/suscripciones' },
    ],
    admin: [
        { label: 'Home', icon: <DashboardIcon />, path: '/home' },
        { label: 'Clientes', icon: <PeopleIcon />, path: '/clientes' },
        { label: 'Carteras', icon: <AccountBalanceWalletIcon />, path: '/carteras' },
        { label: 'Préstamos', icon: <CreditCardIcon />, path: '/creditos' },
        { label: 'Encargados', icon: <GroupsIcon />, path: '/encargados' },
        { label: 'Reportes', icon: <AssessmentIcon />, path: '/reportes' },
    ],
    encargado: [
        { label: 'Home', icon: <DashboardIcon />, path: '/home' },
        { label: 'Clientes', icon: <PeopleIcon />, path: '/clientes' },
        { label: 'Mis Carteras', icon: <AccountBalanceWalletIcon />, path: '/carteras' },
        { label: 'Préstamos', icon: <CreditCardIcon />, path: '/creditos' },
        { label: 'Reportes', icon: <AssessmentIcon />, path: '/reportes' },
    ],
};

const Sidebar = ({ mobileOpen, onClose }) => {
    const { toggleColorMode, mode } = useContext(ColorModeContext);
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    // Estado para controlar el menú colapsable del perfil
    const [bol_menuExpanded, setBol_menuExpanded] = useState(false);

    // Obtener menú...
    const userRole = user?.rol || 'visitante';
    const menuItems = menuItemsByRole[userRole] || menuItemsByRole.admin;
    const isActive = (path) => location.pathname === path;

    const drawerContent = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Logo */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Box sx={{ width: 32, height: 32, bgcolor: 'primary.main', borderRadius: 1.5 }} />
                <Typography variant="h5" color="text.primary" fontWeight="bold">
                    Creditos
                </Typography>
            </Box>

            {/* Navigation - scrollable if needed */}
            <List sx={{
                px: 2,
                flexGrow: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                /* Scrollbar estilizado */
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': {
                    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                    borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                },
                scrollbarWidth: 'thin', /* Firefox */
                scrollbarColor: theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.15) transparent'
                    : 'rgba(0,0,0,0.15) transparent',
            }}>
                {menuItems.map((item) => (
                    <ListItem key={item.label} disablePadding sx={{ mb: 0.25 }}>
                        <ListItemButton
                            selected={isActive(item.path)}
                            onClick={() => {
                                navigate(item.path);
                                if (!isDesktop && onClose) onClose();
                            }}
                            sx={{
                                borderRadius: 3,
                                '&.Mui-selected': {
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    '& .MuiListItemIcon-root': { color: 'inherit' }
                                },
                                '&.Mui-selected:hover': {
                                    bgcolor: 'primary.dark',
                                }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: isActive(item.path) ? 600 : 400 }} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>

            {/* Bottom Section */}
            <Box sx={{ p: 1.5, flexShrink: 0 }}>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        borderRadius: '16px',
                        bgcolor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    {/* Encabezado del perfil con botón de expandir/colapsar */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={user?.user_metadata?.avatar_url} sx={{ bgcolor: 'primary.dark' }}>
                            {user?.email?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.user_metadata?.full_name || 'Usuario'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                {user?.rol?.replace('_', ' ') || 'Cargando...'}
                            </Typography>
                        </Box>
                        {/* Botón chevron para expandir/colapsar opciones */}
                        <IconButton
                            size="small"
                            onClick={() => setBol_menuExpanded(!bol_menuExpanded)}
                            sx={{
                                transition: 'transform 0.3s ease',
                                transform: bol_menuExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                color: 'text.secondary',
                            }}
                        >
                            <ExpandMoreIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Contenido colapsable con las opciones del perfil */}
                    <Collapse in={bol_menuExpanded} timeout="auto" unmountOnExit>
                        <Divider sx={{ my: 1.5 }} />

                        {/* Toggle Dark Mode */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, px: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                                {mode === 'dark' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
                                <Typography variant="body2">Dark Mode</Typography>
                            </Box>
                            <Switch
                                checked={mode === 'dark'}
                                onChange={toggleColorMode}
                                size="small"
                            />
                        </Box>

                        {/* Links de navegación según rol */}
                        {(userRole === 'super_admin' || userRole === 'admin') && (
                            <>
                                <ListItemButton
                                    onClick={() => {
                                        navigate('/actividades');
                                        if (!isDesktop && onClose) onClose();
                                    }}
                                    selected={isActive('/actividades')}
                                    sx={{ borderRadius: 3, pl: 1, mb: 0.5 }}
                                >
                                    <ListItemIcon sx={{ minWidth: 35 }}>
                                        <HistoryIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={userRole === 'super_admin' ? 'Registro Actividades' : 'Mi Actividad'}
                                        primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                </ListItemButton>
                                {userRole === 'super_admin' && (
                                    <ListItemButton
                                        onClick={() => {
                                            navigate('/configuracion');
                                            if (!isDesktop && onClose) onClose();
                                        }}
                                        selected={isActive('/configuracion')}
                                        sx={{ borderRadius: 3, pl: 1, mb: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 35 }}>
                                            <SettingsIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary="Configuración" primaryTypographyProps={{ variant: 'body2' }} />
                                    </ListItemButton>
                                )}
                                {userRole === 'admin' && (
                                    <ListItemButton
                                        onClick={() => {
                                            navigate('/configuracion-admin');
                                            if (!isDesktop && onClose) onClose();
                                        }}
                                        selected={isActive('/configuracion-admin')}
                                        sx={{ borderRadius: 3, pl: 1, mb: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 35 }}>
                                            <SettingsIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary="Configuración" primaryTypographyProps={{ variant: 'body2' }} />
                                    </ListItemButton>
                                )}
                            </>
                        )}

                        {/* Botón de cerrar sesión */}
                        <ListItemButton onClick={signOut} sx={{ borderRadius: 3, color: 'error.main', pl: 1 }}>
                            <ListItemIcon sx={{ minWidth: 35, color: 'inherit' }}>
                                <LogoutIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary="Cerrar Sesión" />
                        </ListItemButton>
                    </Collapse>
                </Paper>
            </Box>
        </Box>
    );

    return (
        <Box
            component="nav"
            sx={{ width: { md: 280 }, flexShrink: { md: 0 } }}
        >
            {/* Mobile Drawer */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={onClose}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280, border: 'none' },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Desktop Drawer */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280, borderRight: '1px solid', borderColor: 'divider' },
                }}
                open
            >
                {drawerContent}
            </Drawer>
        </Box>
    );
};

export default Sidebar;
