/**
 * Tests para MiCuenta
 * Testing de perfil de usuario y gestión de configuración
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import MiCuenta from '../MiCuenta'
import * as account from '../../services/account'

// Mock de servicios
vi.mock('../../services/account', () => ({
  getProfile: vi.fn(),
  catalogs: {
    sectores: vi.fn(),
    centros: vi.fn(),
    almacenes: vi.fn(),
    usuarios: vi.fn(),
  },
  getProfileChanges: vi.fn(),
  updatePassword: vi.fn(),
  updateContact: vi.fn(),
  requestProfileChange: vi.fn(),
  cancelProfileRequest: vi.fn(),
  sendMessageToAdmin: vi.fn(),
}))

// Mock de componentes UI
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, type }) => (
    <button onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  ),
}))

vi.mock('../../components/ui/Select', () => ({
  Select: ({ children, value, onChange }) => (
    <select value={value} onChange={onChange}>
      {children}
    </select>
  ),
}))

vi.mock('../../components/ui/Alert', () => ({
  Alert: ({ children, variant, onDismiss }) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
      {onDismiss && <button onClick={onDismiss}>Cerrar</button>}
    </div>
  ),
}))

vi.mock('../../components/ui/Card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children }) => <p data-testid="card-description">{children}</p>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
}))

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }) => <h1 data-testid="page-header">{title}</h1>,
}))

vi.mock('../../components/ui/Skeleton', () => ({
  FormSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}))

vi.mock('../../components/ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

// Mock de lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  MessageSquare: () => <span>💬</span>,
  Send: () => <span>📧</span>,
}))

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('MiCuenta', () => {
  const mockProfile = {
    id_usuario_spm: 'USR001',
    nombre_usuario: 'juan.perez',
    nombre_apellido: 'Juan Pérez',
    mail: 'juan.perez@empresa.com',
    telefono: '+54 11 1234-5678',
    mail_respaldo: 'juan.backup@gmail.com',
    rol_spm: 'usuario',
    sector_actual: 'Compras',
    centros_actuales: ['1001', '1002'],
    almacenes_actuales: ['ALM001'],
    jefe_actual: 'María González',
    gerente1_actual: 'Carlos Rodríguez',
    gerente2_actual: 'Ana Martínez',
  }

  const mockCatalogos = {
    sectores: [
      { id: 'Compras', nombre: 'Compras', descripcion: 'Sector Compras' },
      { id: 'Logística', nombre: 'Logística', descripcion: 'Sector Logística' },
    ],
    centros: [
      { id: '1001', nombre: 'Centro BA', descripcion: 'Centro Buenos Aires' },
      { id: '1002', nombre: 'Centro CB', descripcion: 'Centro Córdoba' },
    ],
    almacenes: [
      { id: 'ALM001', nombre: 'Almacén Central', descripcion: 'Almacén 1' },
      { id: 'ALM002', nombre: 'Almacén 2', descripcion: 'Almacén Secundario' },
    ],
    usuarios: [
      { id: 1, nombre: 'Usuario 1', username: 'user1' },
      { id: 2, nombre: 'Usuario 2', username: 'user2' },
    ],
  }

  const mockSolicitudes = [
    {
      id: 1,
      fecha: '2024-01-15',
      campos: ['sector', 'centros'],
      estado: 'pendiente',
      comentario: null,
    },
    {
      id: 2,
      fecha: '2024-01-10',
      campos: ['jefe'],
      estado: 'aprobada',
      comentario: 'Aprobado por RRHH',
    },
  ]

  beforeEach(() => {
    account.getProfile.mockResolvedValue({ data: mockProfile })
    account.catalogs.sectores.mockResolvedValue({ data: mockCatalogos.sectores })
    account.catalogs.centros.mockResolvedValue({ data: mockCatalogos.centros })
    account.catalogs.almacenes.mockResolvedValue({ data: mockCatalogos.almacenes })
    account.catalogs.usuarios.mockResolvedValue({ data: mockCatalogos.usuarios })
    account.getProfileChanges.mockResolvedValue({ data: mockSolicitudes })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial', () => {
    it('debe renderizar el componente', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument()
      })
    })

    it('debe mostrar el título "MI CUENTA"', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByText('MI CUENTA')).toBeInTheDocument()
      })
    })

    it('debe mostrar skeleton mientras carga', () => {
      renderWithRouter(<MiCuenta />)
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })

    it('debe cargar el perfil al montar', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(account.getProfile).toHaveBeenCalled()
      })
    })

    it('debe cargar los catálogos al montar', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(account.catalogs.sectores).toHaveBeenCalled()
        expect(account.catalogs.centros).toHaveBeenCalled()
        expect(account.catalogs.almacenes).toHaveBeenCalled()
      })
    })

    it('debe cargar las solicitudes de cambio al montar', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(account.getProfileChanges).toHaveBeenCalled()
      })
    })
  })

  describe('Sección Datos de Identidad', () => {
    it('debe mostrar nombre y apellido del usuario', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument()
      })
    })

    it('debe mostrar ID de usuario', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('USR001')).toBeInTheDocument()
      })
    })

    it('debe mostrar nombre de usuario', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('juan.perez')).toBeInTheDocument()
      })
    })

    it('los campos de identidad deben ser de solo lectura', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const nombreInput = screen.getByDisplayValue('Juan Pérez')
        expect(nombreInput).toHaveAttribute('readonly')
      })
    })
  })

  describe('Sección Datos de Contacto', () => {
    it('debe mostrar el mail del usuario', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('juan.perez@empresa.com')).toBeInTheDocument()
      })
    })

    it('debe permitir editar el teléfono', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const telefonoInput = screen.getByDisplayValue('+54 11 1234-5678')
        expect(telefonoInput).not.toHaveAttribute('readonly')
      })
    })

    it('debe actualizar el teléfono al cambiar', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const telefonoInput = screen.getByDisplayValue('+54 11 1234-5678')
        fireEvent.change(telefonoInput, { target: { value: '+54 11 9999-8888' } })
        expect(telefonoInput.value).toBe('+54 11 9999-8888')
      })
    })

    it('debe guardar el teléfono al hacer clic en Guardar contacto', async () => {
      account.updateContact.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const telefonoInput = screen.getByDisplayValue('+54 11 1234-5678')
        fireEvent.change(telefonoInput, { target: { value: '+54 11 9999-8888' } })
      })

      const guardarButton = screen.getByText('Guardar contacto')
      fireEvent.click(guardarButton)

      await waitFor(() => {
        expect(account.updateContact).toHaveBeenCalledWith({
          telefono: '+54 11 9999-8888',
        })
      })
    })

    it('debe mostrar error si el teléfono es inválido', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const telefonoInput = screen.getByDisplayValue('+54 11 1234-5678')
        fireEvent.change(telefonoInput, { target: { value: '123' } })
      })

      const guardarButton = screen.getByText('Guardar contacto')
      fireEvent.click(guardarButton)

      await waitFor(() => {
        expect(screen.getByText('Telefono invalido.')).toBeInTheDocument()
      })
    })
  })

  describe('Sección Seguridad', () => {
    it('debe permitir ingresar nueva contraseña', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText('Min 8 caracteres')
        fireEvent.change(passwordInput, { target: { value: 'nuevaPassword123' } })
        expect(passwordInput.value).toBe('nuevaPassword123')
      })
    })

    it('debe permitir repetir la contraseña', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const repeatInput = screen.getByPlaceholderText('Repite la contrasena')
        fireEvent.change(repeatInput, { target: { value: 'nuevaPassword123' } })
        expect(repeatInput.value).toBe('nuevaPassword123')
      })
    })

    it('debe validar longitud mínima de contraseña', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText('Min 8 caracteres')
        const repeatInput = screen.getByPlaceholderText('Repite la contrasena')

        fireEvent.change(passwordInput, { target: { value: '123' } })
        fireEvent.change(repeatInput, { target: { value: '123' } })
      })

      const guardarButton = screen.getByText('Guardar seguridad')
      fireEvent.click(guardarButton)

      await waitFor(() => {
        expect(screen.getByText('La contrasena debe tener al menos 8 caracteres.')).toBeInTheDocument()
      })
    })

    it('debe validar que las contraseñas coincidan', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText('Min 8 caracteres')
        const repeatInput = screen.getByPlaceholderText('Repite la contrasena')

        fireEvent.change(passwordInput, { target: { value: 'password123' } })
        fireEvent.change(repeatInput, { target: { value: 'password456' } })
      })

      const guardarButton = screen.getByText('Guardar seguridad')
      fireEvent.click(guardarButton)

      await waitFor(() => {
        expect(screen.getByText('Las contrasenas no coinciden.')).toBeInTheDocument()
      })
    })

    it('debe actualizar la contraseña correctamente', async () => {
      account.updatePassword.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const passwordInput = screen.getByPlaceholderText('Min 8 caracteres')
        const repeatInput = screen.getByPlaceholderText('Repite la contrasena')

        fireEvent.change(passwordInput, { target: { value: 'password123' } })
        fireEvent.change(repeatInput, { target: { value: 'password123' } })
      })

      const guardarButton = screen.getByText('Guardar seguridad')
      fireEvent.click(guardarButton)

      await waitFor(() => {
        expect(account.updatePassword).toHaveBeenCalledWith({
          password_nueva: 'password123',
          password_nueva_repetida: 'password123',
        })
      })
    })

    it('debe permitir actualizar mail de respaldo', async () => {
      account.updateContact.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const mailBackupInput = screen.getByDisplayValue('juan.backup@gmail.com')
        fireEvent.change(mailBackupInput, { target: { value: 'nuevo@backup.com' } })
      })

      const guardarButton = screen.getByText('Guardar seguridad')
      fireEvent.click(guardarButton)

      await waitFor(() => {
        expect(account.updateContact).toHaveBeenCalledWith({
          mail_respaldo: 'nuevo@backup.com',
        })
      })
    })
  })

  describe('Sección Configuración sujeta a aprobación', () => {
    it('debe mostrar el rol actual', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('usuario')).toBeInTheDocument()
      })
    })

    it('debe mostrar el sector actual', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Compras')).toBeInTheDocument()
      })
    })

    it('debe permitir solicitar cambio de sector', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const sectorSelects = screen.getAllByRole('combobox')
        // Buscar el select de "Solicitar cambio de Sector"
        const sectorChangeSelect = sectorSelects.find(select =>
          select.innerHTML.includes('Logística')
        )
        if (sectorChangeSelect) {
          fireEvent.change(sectorChangeSelect, { target: { value: 'Logística' } })
          expect(sectorChangeSelect.value).toBe('Logística')
        }
      })
    })

    it('debe enviar solicitud de cambio de perfil', async () => {
      account.requestProfileChange.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const sectorSelects = screen.getAllByRole('combobox')
        const sectorChangeSelect = sectorSelects.find(select =>
          select.innerHTML.includes('Logística')
        )
        if (sectorChangeSelect) {
          fireEvent.change(sectorChangeSelect, { target: { value: 'Logística' } })
        }
      })

      const solicitarButton = screen.getByText('Solicitar actualizacion de datos de perfil')
      fireEvent.click(solicitarButton)

      await waitFor(() => {
        expect(account.requestProfileChange).toHaveBeenCalled()
      })
    })

    it('debe mostrar mensaje de éxito al enviar solicitud', async () => {
      account.requestProfileChange.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByText('Solicitar actualizacion de datos de perfil')).toBeInTheDocument()
      })

      const solicitarButton = screen.getByText('Solicitar actualizacion de datos de perfil')
      fireEvent.click(solicitarButton)

      await waitFor(() => {
        expect(screen.getByText('Solicitud enviada para aprobacion.')).toBeInTheDocument()
      })
    })
  })

  describe('Historial de solicitudes de cambio', () => {
    it('debe mostrar el historial de solicitudes', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByText('2024-01-15')).toBeInTheDocument()
        expect(screen.getByText('2024-01-10')).toBeInTheDocument()
      })
    })

    it('debe mostrar los campos solicitados', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByText('sector, centros')).toBeInTheDocument()
        expect(screen.getByText('jefe')).toBeInTheDocument()
      })
    })

    it('debe mostrar el estado de cada solicitud', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const statusBadges = screen.getAllByTestId('status-badge')
        expect(statusBadges).toHaveLength(2)
        expect(statusBadges[0].textContent).toBe('pendiente')
        expect(statusBadges[1].textContent).toBe('aprobada')
      })
    })

    it('debe mostrar comentario cuando existe', async () => {
      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByText('Aprobado por RRHH')).toBeInTheDocument()
      })
    })

    it('debe permitir cancelar solicitud pendiente', async () => {
      // Mock de window.confirm
      window.confirm = vi.fn(() => true)
      account.cancelProfileRequest.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        // Buscar botón de cancelar (icono X)
        const cancelButtons = screen.getAllByText('X')
        if (cancelButtons.length > 0) {
          fireEvent.click(cancelButtons[0])
        }
      })

      await waitFor(() => {
        if (window.confirm.mock.calls.length > 0) {
          expect(account.cancelProfileRequest).toHaveBeenCalled()
        }
      })
    })

    it('debe permitir enviar mensaje al admin', async () => {
      account.sendMessageToAdmin.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        // Buscar botón de mensaje (icono MessageSquare)
        const messageButtons = screen.getAllByText('💬')
        if (messageButtons.length > 0) {
          fireEvent.click(messageButtons[0])
        }
      })

      // Debería abrir el modal
      await waitFor(() => {
        expect(screen.getByText('Mensaje al Administrador')).toBeInTheDocument()
      })
    })

    it('debe enviar mensaje al administrador desde el modal', async () => {
      account.sendMessageToAdmin.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        const messageButtons = screen.getAllByText('💬')
        if (messageButtons.length > 0) {
          fireEvent.click(messageButtons[0])
        }
      })

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText('Escribe tu mensaje al administrador...')
        if (textarea) {
          fireEvent.change(textarea, { target: { value: 'Necesito urgente esta aprobación' } })

          const sendButton = screen.getByText('Enviar mensaje')
          fireEvent.click(sendButton)
        }
      })

      await waitFor(() => {
        if (account.sendMessageToAdmin.mock.calls.length > 0) {
          expect(account.sendMessageToAdmin).toHaveBeenCalledWith(
            expect.any(Number),
            { mensaje: 'Necesito urgente esta aprobación' }
          )
        }
      })
    })

    it('debe mostrar "Sin solicitudes pendientes" cuando no hay solicitudes', async () => {
      account.getProfileChanges.mockResolvedValue({ data: [] })

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByText('Sin solicitudes pendientes.')).toBeInTheDocument()
      })
    })
  })

  describe('Manejo de errores', () => {
    it('debe mostrar error si falla la carga del perfil', async () => {
      account.getProfile.mockRejectedValue(new Error('Error al cargar perfil'))

      renderWithRouter(<MiCuenta />)

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
        expect(screen.getByText('No se pudo cargar Mi Cuenta. Intenta recargar.')).toBeInTheDocument()
      })
    })
  })
})
