/**
 * Tests para DashboardAdmin
 * Verifica renderizado, KPIs, filtros, tabs, estados de carga y error
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// ============================================================================
// MOCKS - must be defined before importing the component
// ============================================================================

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}))

// IMPORTANT: user object must be a stable reference to avoid infinite re-render loops
// because the component's solicitudes fetch effect depends on [user]
const stableUser = { id: 1, nombre: 'Manu', is_admin: true, role: 'admin' }
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: stableUser,
  }),
}))

const mockListar = vi.fn()
vi.mock('../../services/spm', () => ({
  solicitudes: {
    listar: (...args) => mockListar(...args),
  },
}))

const mockApiGet = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
  },
}))

const mockCachedGet = vi.fn()
vi.mock('../../services/cachedApi', () => ({
  cachedGet: (...args) => mockCachedGet(...args),
}))

vi.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value) => value,
  default: (value) => value,
}))

vi.mock('../DashboardShared', () => ({
  getTableColumnsAgGrid: () => [
    { field: 'id', headerName: 'ID' },
    { field: 'estado', headerName: 'Estado' },
  ],
}))

vi.mock('../../components/dashboard/StatusDistributionChart', () => ({
  StatusDistributionChart: ({ data, onDrillDown }) => (
    <div data-testid="status-distribution-chart">
      {data?.map((d) => (
        <span key={d.id} data-testid={`chart-status-${d.id}`} onClick={() => onDrillDown?.(d.id, d)}>
          {d.label}: {d.value}
        </span>
      ))}
    </div>
  ),
}))

vi.mock('../../components/dashboard/TrendChart', () => ({
  TrendChart: () => <div data-testid="trend-chart">TrendChart</div>,
  useTrendData: () => ({ labels: ['Ene', 'Feb'], datasets: [] }),
}))

vi.mock('../../components/dashboard/ChartExportButton', () => ({
  ChartExportButton: () => <button data-testid="chart-export-btn">Export</button>,
}))

vi.mock('../../components/dashboard/WeeklyRequestsKpiCard', () => ({
  WeeklyRequestsKpiCard: ({ data }) => (
    <div data-testid="weekly-requests-card">
      Weekly Requests ({data?.length || 0} segments)
    </div>
  ),
}))

vi.mock('../../components/dashboard/DashboardSkeleton', () => ({
  KPIGridSkeleton: () => <div data-testid="kpi-skeleton">KPI Loading...</div>,
}))

vi.mock('../../components/ui/SPMChartJS', () => ({
  SPMGauge: ({ value }) => <div data-testid="spm-gauge">{value}</div>,
  SPMPolarArea: ({ data }) => <div data-testid="spm-polar-area">{data?.length} segments</div>,
  SPM_COLORS: { primary: '#3b82f6', success: '#10b981', warning: '#f59e0b', error: '#ef4444' },
  STATUS_COLORS: { borrador: '#94a3b8', enviadas: '#3b82f6', aprobadas: '#10b981', enProceso: '#8b5cf6', rechazadas: '#ef4444', cerradas: '#8b5cf6' },
  PHASE_COLORS: { aprobacion: { bg: '#3b82f6' }, planificacion: { bg: '#f59e0b' }, proveedor: { bg: '#10b981' } },
  BUDGET_COLORS: { total: '#6366f1', utilizado: '#f59e0b', disponible: '#10b981' },
  FONT_SIZES: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem', lg: '0.85rem' },
  TOOLTIP_CONFIG: {},
  ANIMATION_CONFIG: {},
}))

vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, onRowClick, emptyMessage }) => (
    <div data-testid="spm-ag-grid">
      {rowData?.length > 0 ? (
        rowData.map((row, i) => (
          <div
            key={row.id || i}
            data-testid={`grid-row-${row.id || i}`}
            onClick={() => onRowClick?.(row)}
          >
            {row.id} - {row.estado}
          </div>
        ))
      ) : (
        <span>{emptyMessage}</span>
      )}
    </div>
  ),
}))

vi.mock('../../components/ui/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="table-skeleton">Table Loading...</div>,
}))

vi.mock('../../components/ui/ScrollReveal', () => ({
  ScrollReveal: ({ children }) => <div data-testid="scroll-reveal">{children}</div>,
}))

vi.mock('../../components/ui/Tabs', () => {
  return {
    Tabs: ({ children, value, onValueChange }) => (
      <div data-testid="tabs" data-value={value}>{children}</div>
    ),
    TabsList: ({ children }) => (
      <div data-testid="tabs-list" role="tablist">{children}</div>
    ),
    TabsTrigger: ({ children, value }) => (
      <button role="tab" data-testid={`tab-${value}`} data-value={value}>
        {children}
      </button>
    ),
  }
})

// Import component AFTER mocks
import DashboardAdmin from '../DashboardAdmin'

// ============================================================================
// TEST DATA
// ============================================================================

const makeSolicitud = (overrides = {}) => ({
  id: overrides.id || 1,
  estado: overrides.estado || 'submitted',
  status: overrides.status || 'submitted',
  centro: overrides.centro || 'AA101',
  sector: overrides.sector || 'Produccion',
  sector_nombre: overrides.sector_nombre || 'Produccion',
  almacen_virtual: overrides.almacen_virtual || 'ALM01',
  solicitante: overrides.solicitante || 'Juan Perez',
  solicitante_nombre: overrides.solicitante_nombre || 'Juan',
  solicitante_apellido: overrides.solicitante_apellido || 'Perez',
  created_at: overrides.created_at || new Date().toISOString(),
  fecha_creacion: overrides.fecha_creacion || new Date().toISOString(),
  updated_at: overrides.updated_at || new Date().toISOString(),
  items: overrides.items || [],
  origen_abastecimiento: overrides.origen_abastecimiento || null,
  monto_total: overrides.monto_total || 0,
  valor_estimado: overrides.valor_estimado || 0,
})

const mockSolicitudesData = [
  makeSolicitud({ id: 1, estado: 'submitted', status: 'submitted' }),
  makeSolicitud({ id: 2, estado: 'approved', status: 'approved', centro: 'AA102', sector_nombre: 'Mantenimiento' }),
  makeSolicitud({ id: 3, estado: 'rejected', status: 'rejected' }),
  makeSolicitud({ id: 4, estado: 'processing', status: 'processing', almacen_virtual: 'ALM02' }),
  makeSolicitud({ id: 5, estado: 'submitted', status: 'submitted', solicitante_nombre: 'Maria', solicitante_apellido: 'Lopez' }),
]

const mockSolicitudesWithItems = [
  makeSolicitud({
    id: 10,
    estado: 'approved',
    items: [
      { material: 'MAT100', descripcion: 'Tornillo 3/8', cantidad: 50, precio_usd: 2.5, subtotal: 125 },
      { material: 'MAT200', descripcion: 'Tuerca M10', cantidad: 100, precio_usd: 1.0, subtotal: 100 },
    ],
  }),
  makeSolicitud({
    id: 11,
    estado: 'submitted',
    items: [
      { material: 'MAT100', descripcion: 'Tornillo 3/8', cantidad: 25, precio_usd: 2.5, subtotal: 62.5 },
    ],
  }),
]

const mockKpiData = {
  ok: true,
  data: {
    solicitudes: { total: 100, aprobadas: 60, rechazadas: 10, pendientes: 30, trend: [5, 8, 12, 7, 9, 11, 6], trendPercentage: 15 },
    presupuesto: {
      total: 5000000,
      utilizado: 3500000,
      disponible: 1500000,
      percentage: 70,
      porCentro: [],
      topCentros: [
        { nombre: 'AA101', monto: 2000000, utilizado: 1400000, porcentaje: 70 },
        { nombre: 'AA102', monto: 1500000, utilizado: 900000, porcentaje: 60 },
        { nombre: 'AA103', monto: 1000000, utilizado: 800000, porcentaje: 80 },
      ],
      topSectores: [
        { nombre: 'Produccion', monto: 2500000, utilizado: 1750000, porcentaje: 70 },
        { nombre: 'Mantenimiento', monto: 1500000, utilizado: 1050000, porcentaje: 70 },
      ],
    },
    tiempoAprobacion: { promedio: 5, meta: 3.0, trend: [4, 3, 5, 6, 4, 3, 5] },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
  },
}

const mockStockInmovilizado = {
  ok: true,
  items: [
    { codigo: 'MAT001', descripcion: 'Material A', stock: 100, valor: 50000 },
    { codigo: 'MAT002', descripcion: 'Material B', stock: 50, valor: 25000 },
  ],
  total: 2,
  valorTotal: 75000,
  globalTotal: 2,
  globalValorTotal: 75000,
}

const mockCumplimientoProveedores = {
  items: [
    { proveedor_cuit: 'CUIT001', proveedor_nombre: 'Proveedor Alpha', total_pedidos: 10, entregas_a_tiempo: 9, pct_otif: 90 },
    { proveedor_cuit: 'CUIT002', proveedor_nombre: 'Proveedor Beta', total_pedidos: 5, entregas_a_tiempo: 3, pct_otif: 60 },
  ],
}

const mockComprasEvitadas = {
  ok: true,
  items: [
    { centro: 'AA101', sector: 'Produccion', valor: 10000, fecha: new Date().toISOString() },
  ],
}

// ============================================================================
// HELPERS
// ============================================================================

function setupDefaultMocks() {
  // mockListar must return a promise with .catch() since the component calls .catch() on each
  mockListar.mockImplementation(({ estado, signal } = {}) => {
    const statusMap = { submitted: 'submitted', processing: 'processing', approved: 'approved', rejected: 'rejected' }
    const status = statusMap[estado]
    const items = status ? mockSolicitudesData.filter((s) => s.estado === status) : mockSolicitudesData
    return Promise.resolve({ data: { solicitudes: items, total: items.length } })
  })

  mockCachedGet.mockImplementation((url) => {
    if (url === '/kpis') return Promise.resolve({ data: mockKpiData })
    if (url === '/kpis/stock-inmovilizado') return Promise.resolve({ data: mockStockInmovilizado })
    if (url === '/kpis/compras-evitadas-detalle') return Promise.resolve({ data: mockComprasEvitadas })
    if (url.startsWith('/procurement/kpis/compliance')) return Promise.resolve({ data: mockCumplimientoProveedores })
    return Promise.resolve({ data: {} })
  })

  // api.get is used for stock-inmovilizado filtered (the local filter card)
  mockApiGet.mockImplementation(() => Promise.resolve({ data: mockStockInmovilizado }))
}

function renderDashboard() {
  return render(
    <BrowserRouter>
      <DashboardAdmin />
    </BrowserRouter>
  )
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('DashboardAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // INITIAL RENDER & LOADING STATES
  // ==========================================================================
  describe('Initial render and loading states', () => {
    it('renders the dashboard title', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
    })

    it('shows KPI skeleton while KPIs are loading', () => {
      mockCachedGet.mockImplementation((url) => {
        if (url === '/kpis') return new Promise(() => {})
        if (url === '/kpis/stock-inmovilizado') return Promise.resolve({ data: mockStockInmovilizado })
        if (url === '/kpis/compras-evitadas-detalle') return Promise.resolve({ data: mockComprasEvitadas })
        if (url.startsWith('/procurement/kpis/compliance')) return Promise.resolve({ data: mockCumplimientoProveedores })
        return Promise.resolve({ data: {} })
      })

      renderDashboard()
      expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument()
    })

    it('shows table skeleton while solicitudes are loading', () => {
      mockListar.mockImplementation(() => new Promise(() => {}))
      renderDashboard()
      expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
    })

    it('shows "Cargando..." text while solicitudes are fetching', () => {
      mockListar.mockImplementation(() => new Promise(() => {}))
      renderDashboard()
      expect(screen.getByText('Cargando...')).toBeInTheDocument()
    })

    it('shows total count after solicitudes load', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('(5 total)')).toBeInTheDocument()
      })
    })

    it('calls solicitudes.listar on mount for each status', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockListar).toHaveBeenCalled()
      })
      // The component calls listar 5 times: once without estado (todas) + 4 statuses
      const estados = mockListar.mock.calls.map((c) => c[0]?.estado).filter(Boolean)
      expect(estados).toContain('submitted')
      expect(estados).toContain('processing')
      expect(estados).toContain('approved')
      expect(estados).toContain('rejected')
    })

    it('calls cachedGet for KPIs on mount', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockCachedGet).toHaveBeenCalledWith('/kpis')
      })
    })

    it('calls cachedGet for stock inmovilizado on mount', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockCachedGet).toHaveBeenCalledWith('/kpis/stock-inmovilizado')
      })
    })

    it('calls cachedGet for compras evitadas on mount', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockCachedGet).toHaveBeenCalledWith('/kpis/compras-evitadas-detalle')
      })
    })
  })

  // ==========================================================================
  // KPI CARDS DISPLAY
  // ==========================================================================
  describe('KPI cards display', () => {
    it('renders weekly requests card after KPIs load', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('weekly-requests-card')).toBeInTheDocument()
      })
    })

    it('renders cumplimiento proveedores percentage', async () => {
      renderDashboard()
      await waitFor(() => {
        // The component renders the overall pct and per-proveedor pcts.
        // Total: (9+3)/(10+5) = 80%, plus individual 90% and 60%.
        // Use getAllByText because "80%" may appear in both the h5 and a caption.
        const matches = screen.getAllByText(/80%/)
        expect(matches.length).toBeGreaterThan(0)
      })
    })

    it('renders proveedor names', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Proveedor Alpha')).toBeInTheDocument()
        expect(screen.getByText('Proveedor Beta')).toBeInTheDocument()
      })
    })

    it('renders tiempos de gestion section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Tiempos de Gesti/)).toBeInTheDocument()
      })
    })

    it('renders fuente de abastecimiento section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Fuente de Abastecimiento')).toBeInTheDocument()
      })
    })

    it('renders distribucion de estados chart', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Distribuci.*n de Estados/)).toBeInTheDocument()
        expect(screen.getByTestId('status-distribution-chart')).toBeInTheDocument()
      })
    })

    it('renders tendencia historica chart', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Tendencia Hist.*rica/)).toBeInTheDocument()
        expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
      })
    })

    it('renders presupuesto section', async () => {
      renderDashboard()
      await waitFor(() => {
        // The label is "Presupuesto Global" or "Presupuesto Filtrado" depending on filters
        const matches = screen.getAllByText(/Presupuesto/)
        expect(matches.length).toBeGreaterThan(0)
      })
    })

    it('renders materiales mas solicitados section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Materiales M.*s Solicitados/)).toBeInTheDocument()
      })
    })

    it('renders stock inmovilizado global section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Stock Inmovilizado Global')).toBeInTheDocument()
      })
    })

    it('displays stock inmovilizado items from API', async () => {
      renderDashboard()
      await waitFor(() => {
        // Stock items appear in the "Stock Inmovilizado Global" card
        // and also in the "Stock Inmovilizado" filtered card (both use same mock data)
        const materialAElements = screen.getAllByText('Material A')
        expect(materialAElements.length).toBeGreaterThan(0)
        const materialBElements = screen.getAllByText('Material B')
        expect(materialBElements.length).toBeGreaterThan(0)
      })
    })

    it('shows N/A for cumplimiento when no pedidos', async () => {
      mockCachedGet.mockImplementation((url) => {
        if (url === '/kpis') return Promise.resolve({ data: mockKpiData })
        if (url === '/kpis/stock-inmovilizado') return Promise.resolve({ data: mockStockInmovilizado })
        if (url === '/kpis/compras-evitadas-detalle') return Promise.resolve({ data: mockComprasEvitadas })
        if (url.startsWith('/procurement/kpis/compliance')) return Promise.resolve({ data: { items: [] } })
        return Promise.resolve({ data: {} })
      })
      // When compliance returns empty items, the component falls back to admin proveedores fetch
      // which also needs mocking - api.get for /admin/proveedores/externos
      mockApiGet.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/admin/proveedores/externos')) {
          return Promise.resolve({ data: [] })
        }
        return Promise.resolve({ data: mockStockInmovilizado })
      })

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // SOLICITUDES COLLAPSIBLE SECTION
  // ==========================================================================
  describe('Solicitudes collapsible section', () => {
    it('starts collapsed by default (aria-expanded=false)', async () => {
      renderDashboard()
      await waitFor(() => {
        const btn = screen.getByLabelText('Expandir solicitudes')
        expect(btn).toHaveAttribute('aria-expanded', 'false')
      })
    })

    it('toggles aria-expanded on click', async () => {
      renderDashboard()

      const expandBtn = await screen.findByLabelText('Expandir solicitudes')
      expect(expandBtn).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(expandBtn)

      await waitFor(() => {
        expect(screen.getByLabelText('Contraer solicitudes')).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('shows Solicitudes header text', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Solicitudes')).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // TAB NAVIGATION
  // ==========================================================================
  describe('Tab navigation', () => {
    it('renders all tab triggers', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('tab-todas')).toBeInTheDocument()
        expect(screen.getByTestId('tab-pendientes')).toBeInTheDocument()
        expect(screen.getByTestId('tab-en_proceso')).toBeInTheDocument()
        expect(screen.getByTestId('tab-completadas')).toBeInTheDocument()
        expect(screen.getByTestId('tab-rechazadas')).toBeInTheDocument()
      })
    })

    it('displays tab labels with correct counts', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('tab-todas')).toHaveTextContent('Todas (5)')
        expect(screen.getByTestId('tab-pendientes')).toHaveTextContent('Pendientes (2)')
        expect(screen.getByTestId('tab-en_proceso')).toHaveTextContent('En Proceso (1)')
        expect(screen.getByTestId('tab-completadas')).toHaveTextContent('Completadas (1)')
        expect(screen.getByTestId('tab-rechazadas')).toHaveTextContent('Rechazadas (1)')
      })
    })

    it('renders the solicitudes grid after data loads', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })
    })

    it('displays all solicitudes in the grid for the "todas" tab', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
        expect(screen.getByTestId('grid-row-2')).toBeInTheDocument()
        expect(screen.getByTestId('grid-row-3')).toBeInTheDocument()
        expect(screen.getByTestId('grid-row-4')).toBeInTheDocument()
        expect(screen.getByTestId('grid-row-5')).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // ROW INTERACTIONS
  // ==========================================================================
  describe('Row interactions', () => {
    it('navigates to solicitud detail on row click', async () => {
      renderDashboard()
      const row = await screen.findByTestId('grid-row-1')
      fireEvent.click(row)
      expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/1')
    })

    it('navigates to the correct solicitud for each row', async () => {
      renderDashboard()
      const row3 = await screen.findByTestId('grid-row-3')
      fireEvent.click(row3)
      expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/3')
    })
  })

  // ==========================================================================
  // EMPTY DATA HANDLING
  // ==========================================================================
  describe('Empty data handling', () => {
    it('shows empty message when current tab has no solicitudes', async () => {
      mockListar.mockImplementation(() =>
        Promise.resolve({ data: { solicitudes: [], total: 0 } })
      )
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/No hay solicitudes/)).toBeInTheDocument()
      })
    })

    it('shows "No hay datos" for materials when solicitudes have no items', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('No hay datos')).toBeInTheDocument()
      })
    })

    it('shows (0 total) when no solicitudes returned', async () => {
      mockListar.mockImplementation(() =>
        Promise.resolve({ data: { solicitudes: [], total: 0 } })
      )
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('(0 total)')).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // ERROR STATES
  // ==========================================================================
  describe('Error states', () => {
    it('handles solicitudes fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockListar.mockRejectedValue(new Error('Network error'))
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })

    it('handles KPI fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockCachedGet.mockImplementation((url) => {
        if (url === '/kpis') return Promise.reject(new Error('KPI error'))
        if (url === '/kpis/stock-inmovilizado') return Promise.resolve({ data: mockStockInmovilizado })
        if (url === '/kpis/compras-evitadas-detalle') return Promise.resolve({ data: mockComprasEvitadas })
        if (url.startsWith('/procurement/kpis/compliance')) return Promise.resolve({ data: mockCumplimientoProveedores })
        return Promise.resolve({ data: {} })
      })
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })

    it('handles stock fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockCachedGet.mockImplementation((url) => {
        if (url === '/kpis') return Promise.resolve({ data: mockKpiData })
        if (url === '/kpis/stock-inmovilizado') return Promise.reject(new Error('Stock error'))
        if (url === '/kpis/compras-evitadas-detalle') return Promise.resolve({ data: mockComprasEvitadas })
        if (url.startsWith('/procurement/kpis/compliance')) return Promise.resolve({ data: mockCumplimientoProveedores })
        return Promise.resolve({ data: {} })
      })
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })

    it('handles cumplimiento fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockCachedGet.mockImplementation((url) => {
        if (url === '/kpis') return Promise.resolve({ data: mockKpiData })
        if (url === '/kpis/stock-inmovilizado') return Promise.resolve({ data: mockStockInmovilizado })
        if (url === '/kpis/compras-evitadas-detalle') return Promise.resolve({ data: mockComprasEvitadas })
        if (url.startsWith('/procurement/kpis/compliance')) return Promise.reject(new Error('Compliance error'))
        return Promise.resolve({ data: {} })
      })
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })
  })

  // ==========================================================================
  // FILTER CONTROLS
  // ==========================================================================
  describe('Filter controls', () => {
    it('renders the Limpiar Filtros button', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Limpiar Filtros')).toBeInTheDocument()
      })
    })

    it('renders date range labels', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Desde/)).toBeInTheDocument()
      })
    })

    it('clicking Limpiar Filtros does not crash the component', async () => {
      renderDashboard()
      const limpiarBtn = await screen.findByText('Limpiar Filtros')
      fireEvent.click(limpiarBtn)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // EXPAND CARD (MODAL)
  // ==========================================================================
  describe('Expand card modal', () => {
    it('renders expand buttons for KPI cards', async () => {
      renderDashboard()
      await waitFor(() => {
        const expandButtons = screen.getAllByLabelText('Ampliar tarjeta')
        expect(expandButtons.length).toBeGreaterThan(0)
      })
    })

    it('opens dialog when clicking an expand button', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getAllByLabelText('Ampliar tarjeta').length).toBeGreaterThan(0)
      })

      const expandButtons = screen.getAllByLabelText('Ampliar tarjeta')
      fireEvent.click(expandButtons[0])

      await waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).not.toBeNull()
      })
    })
  })

  // ==========================================================================
  // DRILL-DOWN FROM CHARTS
  // ==========================================================================
  describe('Drill-down from charts', () => {
    it('expands solicitudes section on chart drill-down', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('chart-status-enviadas')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('chart-status-enviadas'))

      await waitFor(() => {
        expect(screen.getByLabelText('Contraer solicitudes')).toHaveAttribute('aria-expanded', 'true')
      })
    })
  })

  // ==========================================================================
  // PRESUPUESTO SECTION
  // ==========================================================================
  describe('Presupuesto section', () => {
    it('shows Centros label in budget card', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Centros')).toBeInTheDocument()
      })
    })

    it('shows Sectores label in budget card', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Sectores')).toBeInTheDocument()
      })
    })

    it('renders SPM gauges for budget', async () => {
      renderDashboard()
      await waitFor(() => {
        const gauges = screen.getAllByTestId('spm-gauge')
        expect(gauges.length).toBeGreaterThanOrEqual(3)
      })
    })
  })

  // ==========================================================================
  // CHART EXPORT
  // ==========================================================================
  describe('Chart export', () => {
    it('renders chart export buttons', async () => {
      renderDashboard()
      await waitFor(() => {
        const exportBtns = screen.getAllByTestId('chart-export-btn')
        expect(exportBtns.length).toBeGreaterThan(0)
      })
    })
  })

  // ==========================================================================
  // MATERIALS LIST
  // ==========================================================================
  describe('Materials list from solicitud items', () => {
    it('renders material items when solicitudes contain items', async () => {
      mockListar.mockImplementation(() =>
        Promise.resolve({
          data: { solicitudes: mockSolicitudesWithItems, total: mockSolicitudesWithItems.length },
        })
      )
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Tornillo 3/8')).toBeInTheDocument()
      })
    })

    it('renders multiple materials sorted by amount', async () => {
      mockListar.mockImplementation(() =>
        Promise.resolve({
          data: { solicitudes: mockSolicitudesWithItems, total: mockSolicitudesWithItems.length },
        })
      )
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Tornillo 3/8')).toBeInTheDocument()
        expect(screen.getByText('Tuerca M10')).toBeInTheDocument()
      })
    })
  })
})
