/**
 * Tests para ProtectedRoute - Normalización de roles
 *
 * Verifica que el parsing de roles funciona correctamente
 * con todos los formatos posibles del backend.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mock del authStore
const mockUseAuthStore = vi.fn()

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore()
}))

// Mock del Layout
vi.mock('../Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>
}))

// Mock del Loading
vi.mock('../Loading', () => ({
  default: () => <div data-testid="loading">Loading...</div>
}))

// Importar después de los mocks
import ProtectedRoute from '../ProtectedRoute'
import { useModuleStore, getModuleForPath } from '../../store/moduleStore'

// Helper para renderizar con router
const renderWithRouter = (ui, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading state', () => {
    it('shows loading when isLoading is true', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false
      })

      renderWithRouter(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })
  })

  describe('Unauthenticated', () => {
    it('redirects to login when not authenticated', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })

      renderWithRouter(
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      )

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  describe('Role normalization', () => {
    it('normalizes simple string role to lowercase', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'Admin' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute roles={['admin']}>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('parses JSON array roles', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: '["planificador", "user"]' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute roles={['planificador']}>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('parses comma-separated roles', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'Planificador,User' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute roles={['planificador']}>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('parses semicolon-separated roles', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'Planificador;User' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute roles={['user']}>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })

  describe('Admin access (MODO DIOS)', () => {
    const adminRoles = ['admin', 'administrador', 'administrator', 'superadmin']

    adminRoles.forEach(adminRole => {
      it(`grants access to any route for "${adminRole}"`, () => {
        mockUseAuthStore.mockReturnValue({
          user: { rol: adminRole },
          isLoading: false,
          isAuthenticated: true
        })

        renderWithRouter(
          <ProtectedRoute roles={['some-special-role']}>
            <div data-testid="content">Protected Content</div>
          </ProtectedRoute>
        )

        expect(screen.getByTestId('content')).toBeInTheDocument()
      })
    })

    it('does NOT grant admin access for partial match "admin_assistant"', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'admin_assistant' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <Routes>
          <Route path="/" element={
            <ProtectedRoute roles={['superuser']}>
              <div data-testid="content">Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      )

      // Debería redirigir a dashboard porque admin_assistant no tiene acceso superuser
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('grants admin access from JSON array with admin', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: '["planificador", "admin"]' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute roles={['some-special-role']}>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })

  describe('Role-based access control', () => {
    it('allows access when user has required role', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'planificador' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute roles={['planificador']}>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('denies access when user lacks required role', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'user' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <Routes>
          <Route path="/" element={
            <ProtectedRoute roles={['planificador']}>
              <div data-testid="content">Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      )

      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('allows access when user has any of the required roles', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'coordinador' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute roles={['planificador', 'coordinador']}>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('allows access when no roles are required', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: 'user' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <ProtectedRoute>
          <div data-testid="content">Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles empty rol string', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: '' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <Routes>
          <Route path="/" element={
            <ProtectedRoute roles={['admin']}>
              <div data-testid="content">Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      )

      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('handles null rol', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: null },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <Routes>
          <Route path="/" element={
            <ProtectedRoute roles={['admin']}>
              <div data-testid="content">Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      )

      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('handles undefined user.rol', () => {
      mockUseAuthStore.mockReturnValue({
        user: {},
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <Routes>
          <Route path="/" element={
            <ProtectedRoute roles={['admin']}>
              <div data-testid="content">Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      )

      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('handles invalid JSON in rol', () => {
      mockUseAuthStore.mockReturnValue({
        user: { rol: '[invalid json' },
        isLoading: false,
        isAuthenticated: true
      })

      renderWithRouter(
        <Routes>
          <Route path="/" element={
            <ProtectedRoute roles={['admin']}>
              <div data-testid="content">Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      )

      // Debería tratar el JSON inválido como string y redirigir
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
  })

  describe('Modulos deshabilitados', () => {
    const adminUser = { user: { id: 1, rol: 'admin' }, isLoading: false, isAuthenticated: true }

    const renderAt = (route) => renderWithRouter(
      <Routes>
        <Route path={route} element={
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
      </Routes>,
      { route }
    )

    beforeEach(() => {
      mockUseAuthStore.mockReturnValue(adminUser)
      useModuleStore.setState({
        isLoaded: true,
        modules: [
          { module_key: 'logistica', enabled: false },
          { module_key: 'calidad', enabled: false },
          { module_key: 'compras', enabled: false },
          { module_key: 'inventario', enabled: true },
        ],
      })
    })

    it('redirige a dashboard si la ruta pertenece a un modulo deshabilitado (incluso admin)', () => {
      renderAt('/tms/shipments')
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('bloquea rutas de calidad', () => {
      renderAt('/quality/ncr')
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('bloquea rutas de compras', () => {
      renderAt('/procurement/savings')
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('permite rutas de modulos habilitados', () => {
      renderAt('/materiales/stock')
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('permite todo mientras los modulos no se cargaron', () => {
      useModuleStore.setState({ isLoaded: false, modules: [] })
      renderAt('/tms/shipments')
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('bloquea submodulos deshabilitados y deja pasar el resto del modulo padre', () => {
      useModuleStore.setState({
        isLoaded: true,
        modules: [
          { module_key: 'inventario', enabled: true },
          { module_key: 'inventario.vmi', enabled: false },
          { module_key: 'planificacion.kanban', enabled: false },
        ],
      })
      renderAt('/operations/vmi/5')
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('un submodulo queda deshabilitado si su padre lo esta', () => {
      useModuleStore.setState({
        isLoaded: true,
        modules: [
          { module_key: 'inventario', enabled: false },
          { module_key: 'inventario.lotes', enabled: true },
        ],
      })
      expect(useModuleStore.getState().isModuleEnabled('inventario.lotes')).toBe(false)
      expect(useModuleStore.getState().isPathEnabled('/operations/lots')).toBe(false)
    })

    it('getModuleForPath mapea prefijos sin falsos positivos', () => {
      expect(getModuleForPath('/operations/production/2')).toBe('planificacion.mps')
      expect(getModuleForPath('/operations/kanban/config')).toBe('planificacion.kanban')
      expect(getModuleForPath('/operations/cycle-count')).toBe('inventario.conteo_ciclico')
      expect(getModuleForPath('/operations/warehouse')).toBe('inventario.recepcion')
      expect(getModuleForPath('/operations/putaway')).toBe('inventario.ubicaciones')
      expect(getModuleForPath('/operations/slob')).toBe('inventario.slob')
      expect(getModuleForPath('/fms/vehicles/3')).toBe('logistica')
      expect(getModuleForPath('/operations/kitting/boms')).toBe('calidad')
      expect(getModuleForPath('/procurement/savings')).toBe('compras')
      expect(getModuleForPath('/admin/supplier-portal/preview')).toBe('compras')
      expect(getModuleForPath('/admin/proveedores')).toBeNull()
      expect(getModuleForPath('/tmsx')).toBeNull()
      expect(getModuleForPath('/materiales/stock')).toBeNull()
    })
  })
})
