/**
 * Tests para Dashboard
 * Verifica que el dashboard unificado se renderice correctamente
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'

// Mock de SEO para evitar HelmetProvider
vi.mock('../../components/SEO', () => ({
  default: () => null,
}))

// Mock de DashboardAdmin (el unico dashboard que se renderiza)
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
  it('renders DashboardAdmin for all users', () => {
    renderDashboard()
    expect(screen.getByTestId('dashboard-admin')).toBeInTheDocument()
  })
})
