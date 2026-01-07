import React from 'react';
import './index.css';
import ConductorDetail from './pages/admin/ConductorDetail';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const CORE_ADMIN_ROLES = ['super_admin', 'director', 'gerente_ops', 'gestor_flota', 'admin'];
const SOLICITUDES_ROLES = ['super_admin', 'director', 'gerente_ops', 'reclutador', 'secretaria', 'admin'];
const PAGOS_ROLES = ['super_admin', 'director', 'gerente_ops', 'contador', 'secretaria', 'admin'];
import Layout from './components/layout/Layout.jsx';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import DriverLogin from './pages/conductor/DriverLogin';
import Usuarios from './pages/admin/Usuarios';
import { Toaster } from 'react-hot-toast'; // 🔥 IMPORTAR TOASTER

// --- IMPORTACIONES PARA EL PORTAL DE CONDUCTOR ---
import DriverLayout from './layouts/DriverLayout';
import ProtectedRouteConductor from './components/conductor/auth/ProtectedRouteConductor.jsx';
import DriverDashboard from './pages/conductor/DriverDashboard.jsx';
import MiVehiculo from './pages/conductor/MiVehiculo.jsx';
import MisPagos from './pages/conductor/MisPagos.jsx';
import Mantenimientos from './pages/conductor/Mantenimientos.jsx';
import Siniestros from './pages/conductor/Siniestros.jsx';
import MiPerfil from './pages/conductor/MiPerfil.jsx';

// Páginas Admin
import AdminDashboard from './pages/admin/Dashboard';
import Conductores from './pages/admin/Conductores';
import Vehiculos from './pages/admin/Vehiculos';
import ContratoDetalle from './pages/admin/ContratoDetalle';
import VehicleDetail3D from './pages/admin/VehicleDetail3D';
import VehiculoHistorial from './pages/admin/vehiculos/Historial';
import RentabilidadVehiculo from './pages/inversionista/RentabilidadVehiculo';

// 🆕 Módulo de Inversionistas
import InversionistasHome from './pages/admin/InversionistasHome';
import SolicitudesInversion from './pages/admin/SolicitudesInversion';
import Inversionistas from './pages/admin/Inversionistas';
import InversionistaDetalle from './pages/admin/InversionistaDetalle';
import HubInversiones from './pages/admin/HubInversiones';
import HubInversionesLista from './pages/admin/HubInversionesLista';

// Sistema de Rentas Modular
import RentasDashboard from './pages/admin/rentas/index';
import RentasPagos from './pages/admin/rentas/Pagos';
import RentasReportes from './pages/admin/rentas/Reportes';
import RentasEstadisticas from './pages/admin/rentas/Estadisticas';

// 🆕 Sistema de Mantenimientos Modular
import MantenimientosDashboard from './pages/admin/mantenimientos/index';
import MantenimientosLista from './pages/admin/mantenimientos/Lista';
import ProgramarMantenimiento from './pages/admin/mantenimientos/Programar';
import CompletarMantenimiento from './pages/admin/mantenimientos/Completar';
import ReportesMantenimientos from './pages/admin/mantenimientos/ReportesMantenimientos';
import DistribuirGastos from './pages/admin/DistribuirGastos';

// 🆕 Sistema de siniestros
import SiniestrosDashboard from './pages/admin/siniestros/index';
import SiniestrosLista from './pages/admin/siniestros/Lista';
import SiniestrosRegistrar from './pages/admin/siniestros/Registrar';
import SiniestroDetalle from './pages/admin/siniestros/Detalle';
import ReportesSiniestros from './pages/admin/siniestros/Reportes';
import SiniestrosHistorialVehiculo from './pages/admin/siniestros/HistorialVehiculo';
import SiniestrosHistorialConductor from './pages/admin/siniestros/HistorialConductor';

// 🆕 Páginas de Solicitudes
import Solicitudes from './pages/admin/Solicitudes';
import SolicitudDetail from './pages/admin/SolicitudDetail';

// Portales Públicos
import PortalInversion from './pages/public/PortalInversion';
import PortalSolicitud from './pages/public/PortalSolicitud';
import ConsultarEstado from './pages/public/ConsultarEstado';

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* 🔥 TOASTER GLOBAL - Muestra las notificaciones */}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />

        <Routes>
          {/* ================================================ */}
          {/* RUTAS DE LOGIN (Públicas) */}
          {/* ================================================ */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* --- 👇 RUTA NUEVA PARA EL CONDUCTOR 👇 --- */}
          <Route path="/conductor/login" element={<DriverLogin />} />
      
          {/* ================================================ */}
          {/* RUTAS PÚBLICAS (Sin autenticación) */}
          {/* ================================================ */}
          <Route path="/solicitar-conductor" element={<PortalSolicitud />} />
          <Route path="/consultar-estado" element={<ConsultarEstado />} />
          <Route path="/portal-inversion" element={<PortalInversion />} />

          {/* ================================================ */}
          {/* 🚗 PORTAL DEL CONDUCTOR (Protegido) */}
          {/* ================================================ */}
          <Route element={<ProtectedRouteConductor />}>
            <Route path="/conductor" element={<DriverLayout />}>
              
              {/* Redirección por defecto */}
              <Route index element={<Navigate to="/conductor/dashboard" replace />} />
              
              {/* Dashboard Principal */}
              <Route path="dashboard" element={<DriverDashboard />} />
              
              {/* Mi Vehículo (con revisión diaria) */}
              <Route path="vehiculo" element={<MiVehiculo />} />
              
              {/* Mis Pagos (historial y registrar) */}
              <Route path="pagos" element={<MisPagos />} />
              
              {/* Mantenimientos (solicitar y ver) */}
              <Route path="mantenimientos" element={<Mantenimientos />} />
              
              {/* Siniestros (reportar y ver) */}
              <Route path="siniestros" element={<Siniestros />} />
              
              {/* Mi Perfil (editar datos y cambiar contraseña) */}
              <Route path="perfil" element={<MiPerfil />} />

            </Route>
          </Route>
          {/* ================================================ */}
          {/* FIN PORTAL DEL CONDUCTOR */}
          {/* ================================================ */}

          {/* ================================================ */}
          {/* PANEL DE ADMINISTRACIÓN (Protegido) */}
          {/* ================================================ */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Redirección de la raíz */}
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            
            {/* Rutas de Admin */}
            <Route
              path="admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin/vehiculos"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <Vehiculos />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/vehiculos/:id"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <VehicleDetail3D />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/vehiculos/:id/historial"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <VehiculoHistorial />
                </ProtectedRoute>
              }
            />

            <Route
              path="rentabilidad-vehiculo/:vehiculoId"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <RentabilidadVehiculo />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin/conductores"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <Conductores />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin/conductores/:id"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <ConductorDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/usuarios"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director']}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />

            {/* MÓDULO DE INVERSIONISTAS */}
            <Route
              path="admin/inversionistas-home"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <InversionistasHome />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/solicitudes-inversion"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <SolicitudesInversion />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/inversionistas"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <Inversionistas />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/inversionistas/:id"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <InversionistaDetalle />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/inversiones/crear"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <HubInversiones />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/inversiones/:id/detalle"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <ContratoDetalle />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/inversiones/hub"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <HubInversionesLista />
                </ProtectedRoute>
              }
            />

            {/* SISTEMA DE RENTAS */}
            <Route
              path="admin/rentas"
              element={
                <ProtectedRoute allowedRoles={[...CORE_ADMIN_ROLES, 'secretaria']}>
                  <RentasDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/rentas/pagos"
              element={
                <ProtectedRoute allowedRoles={PAGOS_ROLES}>
                  <RentasPagos />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/rentas/reportes"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <RentasReportes />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/rentas/estadisticas"
              element={
                <ProtectedRoute allowedRoles={CORE_ADMIN_ROLES}>
                  <RentasEstadisticas />
                </ProtectedRoute>
              }
            />

            {/* SISTEMA DE MANTENIMIENTOS */}
            <Route
              path="admin/mantenimientos"
              element={
                <ProtectedRoute allowedRoles={[...CORE_ADMIN_ROLES, 'jefe_taller', 'compras']}>
                  <MantenimientosDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/mantenimientos/lista"
              element={
                <ProtectedRoute allowedRoles={[...CORE_ADMIN_ROLES, 'jefe_taller', 'compras']}>
                  <MantenimientosLista />
                </ProtectedRoute>
              }
            />
            
            <Route 
              path="/admin/mantenimientos/distribuir-gastos" 
              element={
                <ProtectedRoute allowedRoles={[...CORE_ADMIN_ROLES, 'jefe_taller', 'compras']}>
                  <DistribuirGastos />
                </ProtectedRoute>
              } 
            />

            <Route
              path="admin/mantenimientos/programar"
              element={
                <ProtectedRoute allowedRoles={[...CORE_ADMIN_ROLES, 'jefe_taller', 'compras']}>
                  <ProgramarMantenimiento />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/mantenimientos/:id/completar"
              element={
                <ProtectedRoute allowedRoles={[...CORE_ADMIN_ROLES, 'jefe_taller', 'compras']}>
                  <CompletarMantenimiento />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/mantenimientos/reportes"
              element={
                <ProtectedRoute allowedRoles={[...CORE_ADMIN_ROLES, 'jefe_taller', 'compras']}>
                  <ReportesMantenimientos />
                </ProtectedRoute>
              }
            />

            {/* SISTEMA DE SINIESTROS */}
            <Route
              path="/admin/siniestros/vehiculo/:id/historial"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <SiniestrosHistorialVehiculo />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/admin/siniestros/conductor/:id/historial"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <SiniestrosHistorialConductor />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/siniestros"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <SiniestrosDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/admin/siniestros/lista"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <SiniestrosLista />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/admin/siniestros/registrar"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <SiniestrosRegistrar />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/siniestros/:id"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <SiniestroDetalle />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/admin/siniestros/reportes"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'director', 'gerente_ops', 'admin']}>
                  <ReportesSiniestros />
                </ProtectedRoute>
              }
            />

            {/* RUTAS DE SOLICITUDES ADMIN */}
            <Route
              path="admin/solicitudes"
              element={
                <ProtectedRoute allowedRoles={SOLICITUDES_ROLES}>
                  <Solicitudes />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/solicitudes/:id"
              element={
                <ProtectedRoute allowedRoles={SOLICITUDES_ROLES}>
                  <SolicitudDetail />
                </ProtectedRoute>
              }
            />

          </Route>
          
          {/* Ruta 404 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
