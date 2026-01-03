/**
 * Tests para Dashboard
 * Verifica que el dashboard correcto se muestre segun el rol del usuario
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'
import { useAuthStore } from '../../store/authStore'

// Mock del auth store
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

// Mock de SEO para evitar HelmetProvider
vi.mock('../../components/SEO', () => ({
  default: () => null,
}))

// Mock de los dashboards especificos
vi.mock('../DashboardSolicitante', () => ({
  default: () => <div data-testid="dashboard-solicitante">Dashboard Solicitante</div>,
}))

vi.mock('../DashboardAprobador', () => ({
  default: () => <div data-testid="dashboard-aprobador">Dashboard Aprobador</div>,
}))

vi.mock('../DashboardPlanificador', () => ({
  default: () => <div data-testid="dashboard-planificador">Dashboard Planificador</div>,
}))

vi.mock('../DashboardAdmin', () => ({
  default: () => <div data-testid="dashboard-admin">Dashboard Admin</div>,
}))

const renderDashboard = () => {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Role-based rendering', () => {
    it('renders DashboardSolicitante for users with no special roles', () => {
      useAuthStore.mockReturnValue({
        user: { roles: [], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-solicitante')).toBeInTheDocument()
    })

    it('renders DashboardSolicitante for users with solicitante role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['solicitante'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-solicitante')).toBeInTheDocument()
    })

    it('renders DashboardAprobador for users with aprobador role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['aprobador'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-aprobador')).toBeInTheDocument()
    })

    it('renders DashboardAprobador for users with approver role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['approver'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-aprobador')).toBeInTheDocument()
    })

    it('renders DashboardAprobador for users with jefe role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['jefe'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-aprobador')).toBeInTheDocument()
    })

    it('renders DashboardAprobador for users with gerente1 role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['gerente1'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-aprobador')).toBeInTheDocument()
    })

    it('renders DashboardPlanificador for users with planificador role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['planificador'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-planificador')).toBeInTheDocument()
    })

    it('renders DashboardPlanificador for users with planner role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['planner'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-planificador')).toBeInTheDocument()
    })

    it('renders DashboardAdmin for users with admin role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['admin'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
    })

    it('renders DashboardAdmin for users with administrador role', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['administrador'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
    })

    it('renders DashboardAdmin for users with is_admin flag', () => {
      useAuthStore.mockReturnValue({
        user: { roles: [], is_admin: true },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
    })
  })

  describe('Role priority', () => {
    it('prioritizes admin over planificador', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['planificador', 'admin'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
    })

    it('prioritizes admin over aprobador', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['aprobador', 'admin'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
    })

    it('prioritizes planificador over aprobador', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['aprobador', 'planificador'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-planificador')).toBeInTheDocument()
    })

    it('prioritizes aprobador over solicitante', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['solicitante', 'aprobador'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-aprobador')).toBeInTheDocument()
    })

    it('prioritizes is_admin flag over all roles', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['solicitante'], is_admin: true },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles null user gracefully', () => {
      useAuthStore.mockReturnValue({
        user: null,
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-solicitante')).toBeInTheDocument()
    })

    it('handles undefined roles gracefully', () => {
      useAuthStore.mockReturnValue({
        user: { roles: undefined },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-solicitante')).toBeInTheDocument()
    })

    it('handles empty user object', () => {
      useAuthStore.mockReturnValue({
        user: {},
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-solicitante')).toBeInTheDocument()
    })

    it('handles case-insensitive role matching', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['ADMIN'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
    })

    it('handles mixed case roles', () => {
      useAuthStore.mockReturnValue({
        user: { roles: ['Planificador'], is_admin: false },
      })

      renderDashboard()
      expect(screen.getByTestId('dashboard-planificador')).toBeInTheDocument()
    })
  })
})
