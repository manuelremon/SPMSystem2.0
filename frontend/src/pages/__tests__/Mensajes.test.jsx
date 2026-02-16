/**
 * Tests para Mensajes
 * Testing de inbox/outbox, lectura de mensajes, eliminación
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Mensajes from '../Mensajes'
import api from '../../services/api'
import { useAuthStore } from '../../store/authStore'

// Mock de api
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock de authStore
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 1, nombre: 'Test User' },
  })),
}))

// Mock de i18n
vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}))

// Mock de componentes UI
vi.mock('../../components/ui/Card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
}))

vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title, description, children }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}))

vi.mock('../../components/ui/Alert', () => ({
  Alert: ({ children, onDismiss }) => (
    <div data-testid="alert">
      {children}
      {onDismiss && <button onClick={onDismiss}>Cerrar</button>}
    </div>
  ),
}))

// Mock useToast since the component uses it
vi.mock('../../hooks/useToast', () => ({
  default: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('../../components/MensajeThreadModal', () => ({
  default: ({ message, isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="thread-modal">
        <span>Modal: {message.asunto}</span>
        <button onClick={onClose}>Cerrar</button>
      </div>
    ) : null,
}))

vi.mock('../../components/ui/Icons', () => ({
  Mail: () => <span>📧</span>,
  Send: () => <span>📤</span>,
  Inbox: () => <span>📥</span>,
  MessageSquare: () => <span>💬</span>,
  Clock: () => <span>⏰</span>,
  User: () => <span>👤</span>,
  FileText: () => <span>📄</span>,
  Reply: () => <span>↩</span>,
  Trash2: () => <span>🗑</span>,
  CheckCircle2: () => <span>✓</span>,
  Circle: () => <span>●</span>,
}))

// Datos de prueba
const mockInboxMessages = [
  {
    id: 1,
    asunto: 'Mensaje de prueba 1',
    mensaje: 'Contenido del mensaje 1',
    remitente_nombre: 'Juan',
    remitente_apellido: 'Perez',
    remitente_rol: 'admin',
    leido: 0,
    created_at: '2025-01-01T10:00:00Z',
  },
  {
    id: 2,
    asunto: 'Mensaje de prueba 2',
    mensaje: 'Contenido del mensaje 2',
    remitente_nombre: 'Maria',
    remitente_apellido: 'Garcia',
    remitente_rol: 'coordinador',
    leido: 1,
    created_at: '2025-01-02T10:00:00Z',
  },
]

const mockOutboxMessages = [
  {
    id: 3,
    asunto: 'Mensaje enviado 1',
    mensaje: 'Contenido enviado',
    destinatario_nombre: 'Pedro',
    destinatario_apellido: 'Lopez',
    destinatario_rol: 'usuario',
    created_at: '2025-01-03T10:00:00Z',
  },
]

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <Mensajes />
    </BrowserRouter>
  )
}

describe('Mensajes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mocks
    api.get.mockImplementation((url) => {
      if (url === '/mensajes/inbox') {
        return Promise.resolve({ data: { ok: true, messages: mockInboxMessages } })
      }
      if (url === '/mensajes/outbox') {
        return Promise.resolve({ data: { ok: true, messages: mockOutboxMessages } })
      }
      if (url === '/mensajes/unread-count') {
        return Promise.resolve({ data: { ok: true, unread_count: 1 } })
      }
      return Promise.resolve({ data: { ok: true } })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Page Header', () => {
    it('should render page header with title', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Mensajes')).toBeInTheDocument()
      })
    })

    it('should show unread count badge when there are unread messages', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('1 mensaje nuevo')).toBeInTheDocument()
      })
    })

    it('should show plural unread count', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/mensajes/unread-count') {
          return Promise.resolve({ data: { ok: true, unread_count: 5 } })
        }
        return Promise.resolve({ data: { ok: true, messages: [] } })
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('5 mensajes nuevos')).toBeInTheDocument()
      })
    })
  })

  describe('Tabs', () => {
    it('should render inbox tab by default', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Recibidos')).toBeInTheDocument()
        expect(screen.getByText('Enviados')).toBeInTheDocument()
      })
    })

    it('should switch to outbox when clicking Enviados', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Mensaje de prueba 1')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Enviados'))

      await waitFor(() => {
        expect(screen.getByText('Mensaje enviado 1')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      api.get.mockImplementation(() => new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Cargando mensajes...')).toBeInTheDocument()
    })
  })

  describe('Messages List', () => {
    it('should display inbox messages', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Mensaje de prueba 1')).toBeInTheDocument()
        expect(screen.getByText('Mensaje de prueba 2')).toBeInTheDocument()
      })
    })

    it('should display sender name for inbox messages', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument()
      })
    })

    it('should show empty state when no messages', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('inbox')) {
          return Promise.resolve({ data: { ok: true, messages: [] } })
        }
        return Promise.resolve({ data: { ok: true, unread_count: 0 } })
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No tienes mensajes recibidos')).toBeInTheDocument()
      })
    })

    it('should show outbox empty state', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('outbox')) {
          return Promise.resolve({ data: { ok: true, messages: [] } })
        }
        if (url.includes('inbox')) {
          return Promise.resolve({ data: { ok: true, messages: [] } })
        }
        return Promise.resolve({ data: { ok: true, unread_count: 0 } })
      })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Enviados')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Enviados'))

      await waitFor(() => {
        expect(screen.getByText('No has enviado mensajes')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error when API fails', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('inbox')) {
          return Promise.resolve({ data: { ok: false, error: 'Error del servidor' } })
        }
        return Promise.resolve({ data: { ok: true, unread_count: 0 } })
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })
    })

    it('should display connection error', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('inbox')) {
          return Promise.reject(new Error('Network Error'))
        }
        return Promise.resolve({ data: { ok: true, unread_count: 0 } })
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Error de conexion al cargar mensajes')).toBeInTheDocument()
      })
    })
  })

  describe('Thread Modal', () => {
    it('should open thread modal when clicking message', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Mensaje de prueba 1')).toBeInTheDocument()
      })

      // Click on the message asunto (within the message row)
      fireEvent.click(screen.getByText('Mensaje de prueba 1'))

      await waitFor(() => {
        expect(screen.getByTestId('thread-modal')).toBeInTheDocument()
      })
    })
  })

  describe('Mark as Read', () => {
    it('should call mark-read API when opening unread message', async () => {
      api.post.mockResolvedValue({ data: { ok: true } })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Mensaje de prueba 1')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Mensaje de prueba 1'))

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/mensajes/1/mark-read')
      })
    })
  })
})
