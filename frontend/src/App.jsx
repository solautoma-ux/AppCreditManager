import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ColorModeProvider } from './context/ColorModeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import DashboardMockup from './pages/DashboardMockup';
import Encargados from './pages/Encargados';
import Carteras from './pages/Carteras';
import Clientes from './pages/Clientes';
import Creditos from './pages/Creditos';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Configuracion from './pages/Configuracion';
import Home from './pages/Home';
import Suscripciones from './pages/Suscripciones';
import ReportesOperativos from './pages/ReportesOperativos';
import RegistroActividades from './pages/RegistroActividades';
import ConfiguracionAdmin from './pages/ConfiguracionAdmin';

// Componente para proteger rutas privadas
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div>Cargando...</div>; // O un Spinner bonito
    }

    if (!user) {
        // Preservar query params y hash (ej: error de Supabase)
        const redirectPath = `/login${location.search}${location.hash}`;
        return <Navigate to={redirectPath} replace />;
    }

    // Si el usuario está autenticado pero no tiene rol (no está en public.usuarios)
    // O está INACTIVO
    if ((!user.rol && user.is_registered === false) || user.estado === 'inactivo') {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Layout>{children}</Layout>;
};

// Componente de Redirección Inteligente
const RootRedirect = () => {
    const { user, loading } = useAuth();

    if (loading) return <div>Cargando...</div>;
    if (!user) return <Navigate to="/login" replace />;

    // Super Admin -> Suscripciones
    if (user.rol === 'super_admin') {
        return <Navigate to="/suscripciones" replace />;
    }

    // Admin / Encargado -> Home
    return <Navigate to="/home" replace />;
};

function App() {
    return (
        <Router>
            <ColorModeProvider>
                <ToastProvider>
                    <AuthProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/unauthorized" element={<Unauthorized />} />

                            {/* Ruta Raíz: Redirección según Rol */}
                            <Route
                                path="/"
                                element={
                                    <PrivateRoute>
                                        <RootRedirect />
                                    </PrivateRoute>
                                }
                            />

                            {/* Nuevas Rutas Principales */}
                            <Route
                                path="/home"
                                element={
                                    <PrivateRoute>
                                        <Home />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/suscripciones"
                                element={
                                    <PrivateRoute>
                                        <Suscripciones />
                                    </PrivateRoute>
                                }
                            />

                            <Route
                                path="/carteras"
                                element={
                                    <PrivateRoute>
                                        <Carteras />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/clientes"
                                element={
                                    <PrivateRoute>
                                        <Clientes />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/creditos"
                                element={
                                    <PrivateRoute>
                                        <Creditos />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/encargados"
                                element={
                                    <PrivateRoute>
                                        <Encargados />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/configuracion"
                                element={
                                    <PrivateRoute>
                                        <Configuracion />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/reportes"
                                element={
                                    <PrivateRoute>
                                        <ReportesOperativos />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/actividades"
                                element={
                                    <PrivateRoute>
                                        <RegistroActividades />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/configuracion-admin"
                                element={
                                    <PrivateRoute>
                                        <ConfiguracionAdmin />
                                    </PrivateRoute>
                                }
                            />
                            {/* Redirigir cualquier otra ruta a root */}
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </AuthProvider>
                </ToastProvider>
            </ColorModeProvider>
        </Router>
    );
}

export default App;
