import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate
} from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useModuleStore } from './store/moduleStore'
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
const CentroInteraccion = lazy(() => import('./pages/CentroInteraccion'))
const Ayuda = lazy(() => import('./pages/Ayuda'))
const Trivias = lazy(() => import('./pages/Trivias'))
const Foro = lazy(() => import('./pages/Foro'))
const CompleteRegistration = lazy(() => import('./pages/CompleteRegistration'))
const NuevoUsuario = lazy(() => import('./pages/NuevoUsuario'))
const CatalogoMateriales = lazy(() => import('./pages/CatalogoMateriales'))
const CatalogoEquivalencias = lazy(() => import('./pages/CatalogoEquivalencias'))
const Stock = lazy(() => import('./pages/Stock'))
const StockIndividual = lazy(() => import('./pages/StockIndividual'))
const TodasLasSolicitudes = lazy(() => import('./pages/TodasLasSolicitudes'))

// MRP pages (lazy-loaded)
const MRPTableroAlertas = lazy(() => import('./pages/MRPTableroAlertas'))
const MRPKPIs = lazy(() => import('./pages/MRPKPIs'))
const MRPPortfolio = lazy(() => import('./pages/MRPPortfolio'))
const MRPParametrizar = lazy(() => import('./pages/MRPParametrizar'))

// SLA Dashboard removed - merged into AIAnalytics

// AI Analytics (lazy-loaded)
const AIAnalytics = lazy(() => import('./pages/AIAnalytics'))

// Forecast pages (lazy-loaded)
const ForecastIndividual = lazy(() => import('./pages/ForecastIndividual'))
const ForecastMasivo = lazy(() => import('./pages/ForecastMasivo'))

// Budget pages (lazy-loaded)
const BudgetRequests = lazy(() => import('./pages/BudgetRequests'))
const BudgetRequestCreate = lazy(() => import('./pages/BudgetRequestCreate'))
const BudgetRequestDetail = lazy(() => import('./pages/BudgetRequestDetail'))

// Procurement Dashboard (lazy-loaded)
const ProcurementDashboard = lazy(() => import('./pages/ProcurementDashboard'))
const ProcurementAnalytics = lazy(() => import('./pages/ProcurementAnalytics'))

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
const AdminMateriales = lazy(() => import('./pages/admin/AdminMateriales'))
const AdminProveedores = lazy(() => import('./pages/AdminProveedores'))
const AdminBasesDatos = lazy(() => import('./pages/admin/AdminBasesDatos'))
const AdminMonitorUsuarios = lazy(() => import('./pages/admin/AdminMonitorUsuarios'))
const AdminModules = lazy(() => import('./pages/admin/AdminModules'))

// Shared Files (Compartidos)
const SharedFiles = lazy(() => import('./pages/SharedFiles'))

// Analisis Puntual (admin) - lazy loaded
const AnalisisPuntualHome = lazy(() => import('./pages/admin/AnalisisPuntualHome'))
const AnalisisPuntualMRP = lazy(() => import('./pages/admin/AnalisisPuntualMRP'))
const AnalisisPuntualForecast = lazy(() => import('./pages/admin/AnalisisPuntualForecast'))

// TMS pages (lazy-loaded)
const ShipmentsList = lazy(() => import('./pages/tms/ShipmentsList'))
const ShipmentDetail = lazy(() => import('./pages/tms/ShipmentDetail'))
const ShipmentCreate = lazy(() => import('./pages/tms/ShipmentCreate'))
const Consolidation = lazy(() => import('./pages/tms/Consolidation'))
const TMSRoutes = lazy(() => import('./pages/tms/Routes'))
const TripSettlement = lazy(() => import('./pages/tms/TripSettlement'))
const TMSKPIs = lazy(() => import('./pages/tms/TMSKPIs'))
const TariffRules = lazy(() => import('./pages/tms/TariffRules'))

// FMS pages (lazy-loaded)
const VehiclesList = lazy(() => import('./pages/fms/VehiclesList'))
const VehicleDetail = lazy(() => import('./pages/fms/VehicleDetail'))
const DriversList = lazy(() => import('./pages/fms/DriversList'))
const WorkOrders = lazy(() => import('./pages/fms/WorkOrders'))
const WorkOrderDetail = lazy(() => import('./pages/fms/WorkOrderDetail'))
const FMSKPIs = lazy(() => import('./pages/fms/FMSKPIs'))

// Dashboards editables (lazy-loaded)
const Dashboards = lazy(() => import('./pages/Dashboards'))
const DashboardEditor = lazy(() => import('./pages/DashboardEditor'))
const SpreadsheetShared = lazy(() => import('./pages/SpreadsheetShared'))

// Mobile Scanner (public page, no auth)
const MobileScanner = lazy(() => import('./pages/MobileScanner'))

// New feature pages (lazy-loaded)
const AnomaliaDetection = lazy(() => import('./pages/AnomaliaDetection'))
const MaterialClusters = lazy(() => import('./pages/MaterialClusters'))
const ProveedorScorecard = lazy(() => import('./pages/ProveedorScorecard'))
const ReportesProgramados = lazy(() => import('./pages/ReportesProgramados'))
const AdminAutoAprobacion = lazy(() => import('./pages/AdminAutoAprobacion'))
const AdminEscalacion = lazy(() => import('./pages/AdminEscalacion'))
const AdminWebhooks = lazy(() => import('./pages/AdminWebhooks'))
const ABCAnalysis = lazy(() => import('./pages/ABCAnalysis'))
const WhatIfInventario = lazy(() => import('./pages/WhatIfInventario'))

// Sprint 51-60 pages (lazy-loaded)
const AdminAuditLog = lazy(() => import('./pages/AdminAuditLog'))
const CostSavings = lazy(() => import('./pages/CostSavings'))
const InventoryAging = lazy(() => import('./pages/InventoryAging'))
const Contracts = lazy(() => import('./pages/Contracts'))
const ContractCreate = lazy(() => import('./pages/ContractCreate'))
const ContractDetail = lazy(() => import('./pages/ContractDetail'))
const RFQList = lazy(() => import('./pages/RFQList'))
const RFQCreate = lazy(() => import('./pages/RFQCreate'))
const RFQDetail = lazy(() => import('./pages/RFQDetail'))
const QualityInspections = lazy(() => import('./pages/QualityInspections'))
const InspectionDetail = lazy(() => import('./pages/InspectionDetail'))
const NCRList = lazy(() => import('./pages/NCRList'))
const NCRDetail = lazy(() => import('./pages/NCRDetail'))
const CAPAList = lazy(() => import('./pages/CAPAList'))
const CAPADetail = lazy(() => import('./pages/CAPADetail'))

// Sprint 61-70 pages (lazy-loaded)
const InvoiceList = lazy(() => import('./pages/InvoiceList'))
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'))
const SpendAnalytics = lazy(() => import('./pages/SpendAnalytics'))
const SupplierRiskMap = lazy(() => import('./pages/SupplierRiskMap'))
const DemandPlanning = lazy(() => import('./pages/DemandPlanning'))
const DemandPlanDetail = lazy(() => import('./pages/DemandPlanDetail'))
const ReturnsList = lazy(() => import('./pages/ReturnsList'))
const ReturnDetail = lazy(() => import('./pages/ReturnDetail'))
const WarehouseReceiving = lazy(() => import('./pages/WarehouseReceiving'))
const PutawayTasks = lazy(() => import('./pages/PutawayTasks'))
const ContractCompliance = lazy(() => import('./pages/ContractCompliance'))
const RebatePrograms = lazy(() => import('./pages/RebatePrograms'))
const InventoryOptimization = lazy(() => import('./pages/InventoryOptimization'))
const ServiceLevels = lazy(() => import('./pages/ServiceLevels'))
const SupplierCertifications = lazy(() => import('./pages/SupplierCertifications'))
const SupplierAudits = lazy(() => import('./pages/SupplierAudits'))
const FreightAudit = lazy(() => import('./pages/FreightAudit'))
const FreightTariffs = lazy(() => import('./pages/FreightTariffs'))

// Sprint 71-80 pages (lazy-loaded)
const ControlTower = lazy(() => import('./pages/ControlTower'))
const Sustainability = lazy(() => import('./pages/Sustainability'))
const VMI = lazy(() => import('./pages/VMI'))
const VMIDetail = lazy(() => import('./pages/VMIDetail'))
const LotTraceability = lazy(() => import('./pages/LotTraceability'))
const LotDetail = lazy(() => import('./pages/LotDetail'))
const Recalls = lazy(() => import('./pages/Recalls'))
const RecallDetail = lazy(() => import('./pages/RecallDetail'))
const CycleCounting = lazy(() => import('./pages/CycleCounting'))
const CycleCountDetail = lazy(() => import('./pages/CycleCountDetail'))
const CurrencyManagement = lazy(() => import('./pages/CurrencyManagement'))
const ECOList = lazy(() => import('./pages/ECOList'))
const ECODetail = lazy(() => import('./pages/ECODetail'))
const KitBOMs = lazy(() => import('./pages/KitBOMs'))
const KitBOMDetail = lazy(() => import('./pages/KitBOMDetail'))
const KitOrders = lazy(() => import('./pages/KitOrders'))
const KitOrderDetail = lazy(() => import('./pages/KitOrderDetail'))
const SupplierPortalAdmin = lazy(() => import('./pages/SupplierPortalAdmin'))
const SupplierPortalPreview = lazy(() => import('./pages/SupplierPortalPreview'))
const ProcurementCopilot = lazy(() => import('./pages/ProcurementCopilot'))
const OnboardingList = lazy(() => import('./pages/OnboardingList'))
const OnboardingDetail = lazy(() => import('./pages/OnboardingDetail'))
const SupplierFinance = lazy(() => import('./pages/SupplierFinance'))
const CashflowSimulator = lazy(() => import('./pages/CashflowSimulator'))
const PriceManagement = lazy(() => import('./pages/PriceManagement'))
const PriceCompare = lazy(() => import('./pages/PriceCompare'))
const ConsignmentPrograms = lazy(() => import('./pages/ConsignmentPrograms'))
const ConsignmentDetail = lazy(() => import('./pages/ConsignmentDetail'))
const CustomsOperations = lazy(() => import('./pages/CustomsOperations'))
const HSCodeManagement = lazy(() => import('./pages/HSCodeManagement'))
const PackingLists = lazy(() => import('./pages/PackingLists'))
const PackingDetail = lazy(() => import('./pages/PackingDetail'))
const ProductionPlanning = lazy(() => import('./pages/ProductionPlanning'))
const ProductionDetail = lazy(() => import('./pages/ProductionDetail'))
const KanbanBoard = lazy(() => import('./pages/KanbanBoard'))
const KanbanConfig = lazy(() => import('./pages/KanbanConfig'))
const WarrantyList = lazy(() => import('./pages/WarrantyList'))
const WarrantyClaimDetail = lazy(() => import('./pages/WarrantyClaimDetail'))
const ExecutiveDashboard = lazy(() => import('./pages/ExecutiveDashboard'))
const BenchmarkAnalysis = lazy(() => import('./pages/BenchmarkAnalysis'))

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
          useModuleStore.getState().fetchModules()
        }
      } catch (err) {
      } finally {
        setAppLoading(false)
      }
    }

    init()
  }, [])

  const basename = import.meta.env.BASE_URL || '/'

  const router = useMemo(
    () =>
      createBrowserRouter(
        createRoutesFromElements(
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/nuevo-usuario" element={<ProtectedRoute><NuevoUsuario /></ProtectedRoute>} />
            <Route path="/solicitudes/nueva" element={<ProtectedRoute><CreateSolicitud /></ProtectedRoute>} />
            <Route path="/solicitudes/:id/materiales" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
            <Route path="/mis-solicitudes" element={<ProtectedRoute><MisSolicitudes /></ProtectedRoute>} />
            <Route path="/solicitudes/:id" element={<ProtectedRoute><SolicitudDetalle /></ProtectedRoute>} />
            <Route path="/solicitudes/todas" element={<ProtectedRoute><TodasLasSolicitudes /></ProtectedRoute>} />
            <Route path="/aprobaciones" element={<ProtectedRoute><Aprobaciones /></ProtectedRoute>} />
            <Route path="/aprobaciones/historial" element={<ProtectedRoute><HistorialAprobaciones /></ProtectedRoute>} />
            <Route path="/planificador" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
            <Route path="/planificador/asignadas" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><Planner filterMode="asignadas" /></ProtectedRoute>} />
            <Route path="/planificador/no-asignadas" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><Planner filterMode="no-asignadas" /></ProtectedRoute>} />
            <Route path="/planificador/mrp/alertas" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><MRPTableroAlertas /></ProtectedRoute>} />
            <Route path="/planificador/mrp/kpis" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><MRPKPIs /></ProtectedRoute>} />
            <Route path="/mrp/portfolio" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><MRPPortfolio /></ProtectedRoute>} />
            <Route path="/mrp/parametrizar" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><MRPParametrizar /></ProtectedRoute>} />
            <Route path="/mrp/alertas" element={<Navigate to="/planificador/mrp/alertas" replace />} />
            <Route path="/mrp/kpis" element={<Navigate to="/planificador/mrp/kpis" replace />} />
            <Route path="/planificador/sla" element={<Navigate to="/planificador/ai" replace />} />
            <Route path="/planificador/ai" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><AIAnalytics /></ProtectedRoute>} />
            <Route path="/planificador/forecast" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ForecastIndividual /></ProtectedRoute>} />
            <Route path="/planificador/forecast/masivo" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ForecastMasivo /></ProtectedRoute>} />
            <Route path="/forecast/individual" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ForecastIndividual /></ProtectedRoute>} />
            <Route path="/forecast/masivo" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ForecastMasivo /></ProtectedRoute>} />
            <Route path="/presupuestos" element={<ProtectedRoute roles={['administrador', 'admin', 'jefe', 'coordinador', 'aprobador presupuestos', 'aprobador_presupuestos', 'aprobador de presupuesto']}><BudgetRequests /></ProtectedRoute>} />
            <Route path="/presupuestos/nueva" element={<ProtectedRoute roles={['administrador', 'admin', 'jefe', 'aprobador presupuestos', 'aprobador_presupuestos', 'aprobador de presupuesto']}><BudgetRequestCreate /></ProtectedRoute>} />
            <Route path="/presupuestos/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'jefe', 'coordinador', 'aprobador presupuestos', 'aprobador_presupuestos', 'aprobador de presupuesto']}><BudgetRequestDetail /></ProtectedRoute>} />
            <Route path="/procurement" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ProcurementDashboard /></ProtectedRoute>} />
            <Route path="/procurement/analytics" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ProcurementAnalytics /></ProtectedRoute>} />
            <Route path="/kpi" element={<ProtectedRoute><KPI /></ProtectedRoute>} />
            <Route path="/materiales/catalogo" element={<ProtectedRoute><CatalogoMateriales /></ProtectedRoute>} />
            <Route path="/materiales/equivalencias" element={<ProtectedRoute><CatalogoEquivalencias /></ProtectedRoute>} />
            <Route path="/materiales/stock" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
            <Route path="/materiales/stock-individual" element={<ProtectedRoute><StockIndividual /></ProtectedRoute>} />
            <Route path="/mensajes" element={<ProtectedRoute><Mensajes /></ProtectedRoute>} />
            <Route path="/notificaciones" element={<ProtectedRoute><Notificaciones /></ProtectedRoute>} />
            <Route path="/centro-interaccion" element={<ProtectedRoute><CentroInteraccion /></ProtectedRoute>} />
            <Route path="/mi-cuenta" element={<ProtectedRoute><MiCuenta /></ProtectedRoute>} />
            <Route path="/ayuda" element={<ProtectedRoute><Ayuda /></ProtectedRoute>} />
            <Route path="/trivias" element={<ProtectedRoute><Trivias /></ProtectedRoute>} />
            <Route path="/foro" element={<ProtectedRoute><Foro /></ProtectedRoute>} />
            <Route path="/dashboards" element={<ProtectedRoute><Dashboards /></ProtectedRoute>} />
            <Route path="/dashboards/:uuid" element={<ProtectedRoute><DashboardEditor /></ProtectedRoute>} />
            <Route path="/shared/:token" element={<SpreadsheetShared />} />
            <Route path="/scan/:sessionId" element={<MobileScanner />} />
            {/* TMS Routes */}
            <Route path="/tms/shipments" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ShipmentsList /></ProtectedRoute>} />
            <Route path="/tms/shipments/new" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ShipmentCreate /></ProtectedRoute>} />
            <Route path="/tms/shipments/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ShipmentDetail /></ProtectedRoute>} />
            <Route path="/tms/consolidation" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><Consolidation /></ProtectedRoute>} />
            <Route path="/tms/routes" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><TMSRoutes /></ProtectedRoute>} />
            <Route path="/tms/settlements" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><TripSettlement /></ProtectedRoute>} />
            <Route path="/tms/kpis" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><TMSKPIs /></ProtectedRoute>} />
            <Route path="/tms/tariff-rules" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><TariffRules /></ProtectedRoute>} />
            {/* FMS Routes */}
            <Route path="/fms/vehicles" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><VehiclesList /></ProtectedRoute>} />
            <Route path="/fms/vehicles/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><VehicleDetail /></ProtectedRoute>} />
            <Route path="/fms/drivers" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><DriversList /></ProtectedRoute>} />
            <Route path="/fms/work-orders" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><WorkOrders /></ProtectedRoute>} />
            <Route path="/fms/work-orders/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><WorkOrderDetail /></ProtectedRoute>} />
            <Route path="/fms/kpis" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><FMSKPIs /></ProtectedRoute>} />
            {/* IA / Analytics Routes */}
            <Route path="/planificador/anomalias" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><AnomaliaDetection /></ProtectedRoute>} />
            <Route path="/planificador/clusters" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><MaterialClusters /></ProtectedRoute>} />
            <Route path="/procurement/scorecard" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ProveedorScorecard /></ProtectedRoute>} />
            <Route path="/analytics/abc" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ABCAnalysis /></ProtectedRoute>} />
            <Route path="/analytics/what-if" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><WhatIfInventario /></ProtectedRoute>} />
            {/* Admin Routes */}
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
            <Route path="/admin/proveedores" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminProveedores /></ProtectedRoute>} />
            <Route path="/admin/bases-datos" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminBasesDatos /></ProtectedRoute>} />
            <Route path="/admin/monitor-usuarios" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminMonitorUsuarios /></ProtectedRoute>} />
            <Route path="/admin/analisis-puntual" element={<ProtectedRoute roles={['administrador', 'admin']}><AnalisisPuntualHome /></ProtectedRoute>} />
            <Route path="/admin/analisis-puntual/mrp" element={<ProtectedRoute roles={['administrador', 'admin']}><AnalisisPuntualMRP /></ProtectedRoute>} />
            <Route path="/admin/analisis-puntual/forecast" element={<ProtectedRoute roles={['administrador', 'admin']}><AnalisisPuntualForecast /></ProtectedRoute>} />
            <Route path="/admin/auto-aprobacion" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminAutoAprobacion /></ProtectedRoute>} />
            <Route path="/admin/escalacion" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminEscalacion /></ProtectedRoute>} />
            <Route path="/admin/webhooks" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminWebhooks /></ProtectedRoute>} />
            <Route path="/admin/audit-log" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/modules" element={<ProtectedRoute roles={['administrador', 'admin']}><AdminModules /></ProtectedRoute>} />
            <Route path="/reportes/programados" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ReportesProgramados /></ProtectedRoute>} />
            {/* Procurement - Sprints 52, 54-58 */}
            <Route path="/procurement/savings" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><CostSavings /></ProtectedRoute>} />
            <Route path="/procurement/contracts" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><Contracts /></ProtectedRoute>} />
            <Route path="/procurement/contracts/new" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ContractCreate /></ProtectedRoute>} />
            <Route path="/procurement/contracts/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ContractDetail /></ProtectedRoute>} />
            <Route path="/procurement/rfq" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><RFQList /></ProtectedRoute>} />
            <Route path="/procurement/rfq/new" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><RFQCreate /></ProtectedRoute>} />
            <Route path="/procurement/rfq/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><RFQDetail /></ProtectedRoute>} />
            {/* Operations - Sprint 53 */}
            <Route path="/operations/slob" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><InventoryAging /></ProtectedRoute>} />
            {/* Quality - Sprints 59-60 */}
            <Route path="/quality/inspections" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><QualityInspections /></ProtectedRoute>} />
            <Route path="/quality/inspections/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><InspectionDetail /></ProtectedRoute>} />
            <Route path="/quality/ncr" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><NCRList /></ProtectedRoute>} />
            <Route path="/quality/ncr/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><NCRDetail /></ProtectedRoute>} />
            <Route path="/quality/capa" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><CAPAList /></ProtectedRoute>} />
            <Route path="/quality/capa/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><CAPADetail /></ProtectedRoute>} />
            {/* P2P & Matching - Sprint 61 */}
            <Route path="/procurement/invoices" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><InvoiceList /></ProtectedRoute>} />
            <Route path="/procurement/invoices/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><InvoiceDetail /></ProtectedRoute>} />
            {/* Analytics - Sprint 62 */}
            <Route path="/analytics/spend" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><SpendAnalytics /></ProtectedRoute>} />
            {/* Supplier Risk - Sprint 63 */}
            <Route path="/procurement/supplier-risk" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><SupplierRiskMap /></ProtectedRoute>} />
            {/* Demand Planning - Sprint 64 */}
            <Route path="/planning/demand" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><DemandPlanning /></ProtectedRoute>} />
            <Route path="/planning/demand/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><DemandPlanDetail /></ProtectedRoute>} />
            {/* Returns & RMA - Sprint 65 */}
            <Route path="/operations/returns" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ReturnsList /></ProtectedRoute>} />
            <Route path="/operations/returns/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ReturnDetail /></ProtectedRoute>} />
            {/* Warehouse - Sprint 66 */}
            <Route path="/operations/warehouse" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><WarehouseReceiving /></ProtectedRoute>} />
            <Route path="/operations/putaway" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><PutawayTasks /></ProtectedRoute>} />
            {/* Compliance & Rebates - Sprint 67 */}
            <Route path="/procurement/compliance" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ContractCompliance /></ProtectedRoute>} />
            <Route path="/procurement/rebates" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><RebatePrograms /></ProtectedRoute>} />
            {/* Inventory Optimization - Sprint 68 */}
            <Route path="/operations/inventory-optimization" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><InventoryOptimization /></ProtectedRoute>} />
            <Route path="/operations/niveles-de-servicio" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ServiceLevels /></ProtectedRoute>} />
            <Route path="/operations/service-levels" element={<Navigate to="/operations/niveles-de-servicio" replace />} />
            {/* Supplier Audit - Sprint 69 */}
            <Route path="/procurement/certifications" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><SupplierCertifications /></ProtectedRoute>} />
            <Route path="/procurement/audits" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><SupplierAudits /></ProtectedRoute>} />
            {/* Freight Audit - Sprint 70 */}
            <Route path="/tms/freight" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><FreightAudit /></ProtectedRoute>} />
            <Route path="/tms/tariffs" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><FreightTariffs /></ProtectedRoute>} />
            {/* Control Tower - Sprint 71 */}
            <Route path="/analytics/control-tower" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ControlTower /></ProtectedRoute>} />
            {/* Sustainability - Sprint 72 */}
            <Route path="/analytics/sustainability" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><Sustainability /></ProtectedRoute>} />
            {/* VMI - Sprint 73 */}
            <Route path="/operations/vmi" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><VMI /></ProtectedRoute>} />
            <Route path="/operations/vmi/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><VMIDetail /></ProtectedRoute>} />
            {/* Lot Traceability - Sprint 74 */}
            <Route path="/operations/lots" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><LotTraceability /></ProtectedRoute>} />
            <Route path="/operations/lots/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><LotDetail /></ProtectedRoute>} />
            <Route path="/operations/recalls" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><Recalls /></ProtectedRoute>} />
            <Route path="/operations/recalls/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><RecallDetail /></ProtectedRoute>} />
            {/* Cycle Counting - Sprint 75 */}
            <Route path="/operations/cycle-count" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><CycleCounting /></ProtectedRoute>} />
            <Route path="/operations/cycle-count/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><CycleCountDetail /></ProtectedRoute>} />
            {/* Multi-Currency - Sprint 76 */}
            <Route path="/admin/currency" element={<ProtectedRoute roles={['administrador', 'admin']}><CurrencyManagement /></ProtectedRoute>} />
            {/* ECO - Sprint 77 */}
            <Route path="/engineering/eco" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ECOList /></ProtectedRoute>} />
            <Route path="/engineering/eco/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ECODetail /></ProtectedRoute>} />
            {/* Kitting - Sprint 78 */}
            <Route path="/operations/kitting/boms" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><KitBOMs /></ProtectedRoute>} />
            <Route path="/operations/kitting/boms/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><KitBOMDetail /></ProtectedRoute>} />
            <Route path="/operations/kitting/orders" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><KitOrders /></ProtectedRoute>} />
            <Route path="/operations/kitting/orders/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><KitOrderDetail /></ProtectedRoute>} />
            {/* Supplier Portal - Sprint 79 */}
            <Route path="/admin/supplier-portal" element={<ProtectedRoute roles={['administrador', 'admin']}><SupplierPortalAdmin /></ProtectedRoute>} />
            <Route path="/admin/supplier-portal/preview" element={<ProtectedRoute roles={['administrador', 'admin']}><SupplierPortalPreview /></ProtectedRoute>} />
            {/* AI Copilot - Sprint 80 */}
            <Route path="/ai/copilot" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ProcurementCopilot /></ProtectedRoute>} />
            {/* Supplier Onboarding - Sprint 81 */}
            <Route path="/admin/supplier-onboarding" element={<ProtectedRoute roles={['administrador', 'admin']}><OnboardingList /></ProtectedRoute>} />
            <Route path="/admin/supplier-onboarding/:id" element={<ProtectedRoute roles={['administrador', 'admin']}><OnboardingDetail /></ProtectedRoute>} />
            {/* Price Management - Sprint 82 */}
            <Route path="/procurement/prices" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><PriceManagement /></ProtectedRoute>} />
            <Route path="/procurement/prices/compare" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><PriceCompare /></ProtectedRoute>} />
            {/* Consignment Inventory - Sprint 83 */}
            <Route path="/operations/consignment" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ConsignmentPrograms /></ProtectedRoute>} />
            <Route path="/operations/consignment/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ConsignmentDetail /></ProtectedRoute>} />
            {/* Customs & Trade Compliance - Sprint 84 */}
            <Route path="/operations/customs" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><CustomsOperations /></ProtectedRoute>} />
            <Route path="/operations/customs/hs-codes" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><HSCodeManagement /></ProtectedRoute>} />
            {/* Kanban & Pull Replenishment - Sprint 85 */}
            <Route path="/operations/kanban" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><KanbanBoard /></ProtectedRoute>} />
            <Route path="/operations/kanban/config" element={<ProtectedRoute roles={['administrador', 'admin']}><KanbanConfig /></ProtectedRoute>} />
            {/* Production Planning - Sprint 86 */}
            <Route path="/operations/production" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ProductionPlanning /></ProtectedRoute>} />
            <Route path="/operations/production/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><ProductionDetail /></ProtectedRoute>} />
            {/* Warranty & Claims - Sprint 87 */}
            <Route path="/operations/warranty" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><WarrantyList /></ProtectedRoute>} />
            <Route path="/operations/warranty/claims/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><WarrantyClaimDetail /></ProtectedRoute>} />
            {/* Packaging & Labels - Sprint 88 */}
            <Route path="/operations/packaging" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><PackingLists /></ProtectedRoute>} />
            <Route path="/operations/packaging/:id" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><PackingDetail /></ProtectedRoute>} />
            {/* Supplier Finance - Sprint 89 */}
            <Route path="/finance/supplier-finance" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><SupplierFinance /></ProtectedRoute>} />
            <Route path="/finance/supplier-finance/simulator" element={<ProtectedRoute roles={['administrador', 'admin', 'planificador']}><CashflowSimulator /></ProtectedRoute>} />
            {/* Executive Analytics - Sprint 90 */}
            <Route path="/analytics/executive" element={<ProtectedRoute roles={['administrador', 'admin', 'coordinador', 'jefe']}><ExecutiveDashboard /></ProtectedRoute>} />
            <Route path="/analytics/executive/benchmarks" element={<ProtectedRoute roles={['administrador', 'admin']}><BenchmarkAnalysis /></ProtectedRoute>} />
            {/* Shared Files (Compartidos) */}
            <Route path="/compartidos" element={<ProtectedRoute roles={['administrador', 'admin', 'compartidos']}><SharedFiles /></ProtectedRoute>} />
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
    [basename]
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
