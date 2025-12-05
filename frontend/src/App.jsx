import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate
} from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { fetchCsrfToken } from './services/csrf'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Loading from './components/Loading'

// Lazy-loaded pages for code splitting (large/complex pages)
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CreateSolicitud = lazy(() => import('./pages/CreateSolicitud'))
const Materials = lazy(() => import('./pages/Materials'))
const MisSolicitudes = lazy(() => import('./pages/MisSolicitudes'))
const SolicitudDetalle = lazy(() => import('./pages/SolicitudDetalle'))
const Aprobaciones = lazy(() => import('./pages/Aprobaciones'))
const HistorialAprobaciones = lazy(() => import('./pages/HistorialAprobaciones'))
const Planner = lazy(() => import('./pages/Planner'))
const KPI = lazy(() => import('./pages/KPI'))
const MiCuenta = lazy(() => import('./pages/MiCuenta'))
const Mensajes = lazy(() => import('./pages/Mensajes'))
const Notificaciones = lazy(() => import('./pages/Notificaciones'))
const Ayuda = lazy(() => import('./pages/Ayuda'))
const Trivias = lazy(() => import('./pages/Trivias'))
const Foro = lazy(() => import('./pages/Foro'))
const CompleteRegistration = lazy(() => import('./pages/CompleteRegistration'))
const CatalogoMateriales = lazy(() => import('./pages/CatalogoMateriales'))
const CatalogoEquivalencias = lazy(() => import('./pages/CatalogoEquivalencias'))

// Budget pages (lazy-loaded)
const BudgetRequests = lazy(() => import('./pages/BudgetRequests'))
const BudgetRequestCreate = lazy(() => import('./pages/BudgetRequestCreate'))
const BudgetRequestDetail = lazy(() => import('./pages/BudgetRequestDetail'))

// Admin pages (lazy-loaded)
const AdminCentros = lazy(() => import('./pages/admin/AdminCentros'))
const AdminAlmacenes = lazy(() => import('./pages/admin/AdminAlmacenes'))
const AdminSectores = lazy(() => import('./pages/admin/AdminSectores'))
const AdminUsuarios = lazy(() => import('./pages/admin/AdminUsuarios'))
const AdminSolicitudesPerfil = lazy(() => import('./pages/AdminSolicitudesPerfil'))
const AdminPuestos = lazy(() => import('./pages/admin/AdminPuestos'))
const AdminRoles = lazy(() => import('./pages/admin/AdminRoles'))
const AdminPlanificadores = lazy(() => import('./pages/admin/AdminPlanificadores'))
const AdminPresupuestos = lazy(() => import('./pages/admin/AdminPresupuestos'))
const AdminEstado = lazy(() => import('./pages/admin/AdminEstado'))
const AdminMetricas = lazy(() => import('./pages/admin/AdminMetricas'))
const AdminMateriales = lazy(() => import('./pages/admin/AdminMateriales'))
const AdminProveedores = lazy(() => import('./pages/AdminProveedores'))

function App() {
  const { user, isLoading, getCurrentUser } = useAuthStore()
  const [appLoading, setAppLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        await fetchCsrfToken()
        // Solo intenta obtener usuario si está en ruta protegida
        const isLoginPath = window.location.pathname === '/login'
        if (!isLoginPath && user === null) {
          await getCurrentUser()
        }
      } catch (err) {
        console.error('App init error:', err)
      } finally {
        setAppLoading(false)
      }
    }

    init()
  }, [])

  // Detectar basename para GitHub Pages
  const basename = import.meta.env.BASE_URL || '/'

  const router = useMemo(
    () =>
      createBrowserRouter(
        createRoutesFromElements(
          <>
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/solicitudes/nueva" element={<ProtectedRoute><CreateSolicitud /></ProtectedRoute>} />
            <Route path="/solicitudes/:id/materiales" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
            <Route path="/mis-solicitudes" element={<ProtectedRoute><MisSolicitudes /></ProtectedRoute>} />
            <Route path="/solicitudes/:id" element={<ProtectedRoute><SolicitudDetalle /></ProtectedRoute>} />
            <Route path="/aprobaciones" element={<ProtectedRoute><Aprobaciones /></ProtectedRoute>} />
            <Route path="/aprobaciones/historial" element={<ProtectedRoute><HistorialAprobaciones /></ProtectedRoute>} />
            <Route path="/planificador" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
            <Route path="/presupuestos" element={<ProtectedRoute roles={['administrador', 'admin', 'jefe', 'coordinador']}><BudgetRequests /></ProtectedRoute>} />
            <Route path="/presupuestos/nueva" element={<ProtectedRoute roles={['administrador', 'admin', 'jefe']}><BudgetRequestCreate /></ProtectedRoute>} />
            <Route path="/presupuestos/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'jefe', 'coordinador']}><BudgetRequestDetail /></ProtectedRoute>} />
            <Route path="/kpi" element={<ProtectedRoute><KPI /></ProtectedRoute>} />
            <Route path="/materiales/catalogo" element={<ProtectedRoute><CatalogoMateriales /></ProtectedRoute>} />
            <Route path="/materiales/equivalencias" element={<ProtectedRoute><CatalogoEquivalencias /></ProtectedRoute>} />
            <Route path="/mensajes" element={<ProtectedRoute><Mensajes /></ProtectedRoute>} />
            <Route path="/notificaciones" element={<ProtectedRoute><Notificaciones /></ProtectedRoute>} />
            <Route path="/mi-cuenta" element={<ProtectedRoute><MiCuenta /></ProtectedRoute>} />
            <Route path="/ayuda" element={<ProtectedRoute><Ayuda /></ProtectedRoute>} />
            <Route path="/trivias" element={<ProtectedRoute><Trivias /></ProtectedRoute>} />
            <Route path="/foro" element={<ProtectedRoute><Foro /></ProtectedRoute>} />
            <Route path="/admin/centros" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminCentros /></ProtectedRoute>} />
            <Route path="/admin/almacenes" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminAlmacenes /></ProtectedRoute>} />
            <Route path="/admin/sectores" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminSectores /></ProtectedRoute>} />
            <Route path="/admin/usuarios" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminUsuarios /></ProtectedRoute>} />
            <Route path="/admin/solicitudes-perfil" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminSolicitudesPerfil /></ProtectedRoute>} />
            <Route path="/admin/puestos" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminPuestos /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminRoles /></ProtectedRoute>} />
            <Route path="/admin/planificadores" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminPlanificadores /></ProtectedRoute>} />
            <Route path="/admin/presupuestos" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminPresupuestos /></ProtectedRoute>} />
            <Route path="/admin/materiales" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminMateriales /></ProtectedRoute>} />
            <Route path="/admin/estado" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminEstado /></ProtectedRoute>} />
            <Route path="/admin/metricas" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminMetricas /></ProtectedRoute>} />
            <Route path="/admin/proveedores" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminProveedores /></ProtectedRoute>} />
            <Route path="/registro/completar" element={<ProtectedRoute><CompleteRegistration /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </>
        ),
        {
          basename,
          future: {
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }
        }
      ),
    [user, basename]
  )

  if (appLoading || isLoading) {
    return <Loading />
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
