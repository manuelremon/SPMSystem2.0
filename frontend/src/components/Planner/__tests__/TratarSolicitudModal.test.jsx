/**
 * Tests para TratarSolicitudModal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TratarSolicitudModal from '../TratarSolicitudModal'
import api from '../../../services/api'

// Mock de servicios
vi.mock('../../../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('../../../services/csrf', () => ({
  ensureCsrfToken: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../hooks/useToast', () => ({
  default: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

// Mock de componentes hijos
vi.mock('../Paso1AnalisisInicial', () => ({
  default: ({ onNext, onReject, onRequestInfo }) => (
    <div data-testid="paso1">
      <button onClick={onNext}>Continuar Paso1</button>
      <button onClick={onReject}>Rechazar Paso1</button>
      <button onClick={onRequestInfo}>Info Paso1</button>
    </div>
  ),
}))

vi.mock('../Paso2DecisionAbastecimiento', () => ({
  default: ({ onPrev, onNext }) => (
    <div data-testid="paso2">
      <button onClick={onPrev}>Volver Paso2</button>
      <button onClick={onNext}>Continuar Paso2</button>
    </div>
  ),
}))

vi.mock('../Paso3RevisionFinal', () => ({
  default: () => <div data-testid="paso3">Paso3</div>,
}))

vi.mock('../Paso4AccionesPendientes', () => ({
  default: () => <div data-testid="paso4">Paso4</div>,
}))

vi.mock('../../ui/Button', () => ({
  Button: ({ children, onClick, type, disabled, style }) => (
    <button onClick={onClick} type={type} disabled={disabled} style={style}>
      {children}
    </button>
  ),
}))

vi.mock('../../ui/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children, footer }) => (
    isOpen ? (
      <div data-testid="modal">
        <h3>{title}</h3>
        {children}
        <div data-testid="modal-footer">{footer}</div>
      </div>
    ) : null
  ),
}))

vi.mock('../../ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

vi.mock('../../../constants/sectores', () => ({
  renderSector: (sol) => sol?.sector || 'N/D',
}))

vi.mock('../../../utils/formatters', () => ({
  formatAlmacen: (val) => val || 'N/D',
}))

vi.mock('../../../utils/styleConfig', () => ({
  getCriticidadConfig: () => ({ color: '#000', bg: '#fff', label: 'Normal' }),
}))

describe('TratarSolicitudModal', () => {
  const defaultProps = {
    solicitud: {
      id: 1,
      centro: '1008',
      sector: 'Mantenimiento',
      almacen_virtual: 'ALM001',
      criticidad: 'Normal',
    },
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    api.post.mockResolvedValue({
      data: {
        data: {
          resumen: { total_items: 0 },
          materiales_por_criticidad: {},
        },
      },
    })
    api.get.mockResolvedValue({ data: { data: { opciones: [] } } })
  })

  /** Helper: renderiza y espera que termine la carga del analisis */
  const renderAndWaitForLoad = async (props = defaultProps) => {
    const result = render(<TratarSolicitudModal {...props} />)
    await waitFor(() => {
      expect(screen.getByTestId('paso1')).toBeInTheDocument()
    })
    return result
  }

  describe('Renderizado basico', () => {
    it('debe renderizar el modal cuando isOpen es true', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByText('Analisis')).toBeInTheDocument()
    })

    it('no debe renderizar cuando isOpen es false', () => {
      render(<TratarSolicitudModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Analisis')).not.toBeInTheDocument()
    })

    it('no debe renderizar cuando solicitud es null', () => {
      render(<TratarSolicitudModal {...defaultProps} solicitud={null} />)
      expect(screen.queryByText('Analisis')).not.toBeInTheDocument()
    })
  })

  describe('Header del modal', () => {
    it('debe mostrar informacion del centro', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByText(/1008/)).toBeInTheDocument()
    })

    it('debe mostrar sector', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByText('Mantenimiento')).toBeInTheDocument()
    })

    it('debe llamar onClose al hacer clic en el boton de cerrar', async () => {
      const onClose = vi.fn()
      await renderAndWaitForLoad({ ...defaultProps, onClose })

      const closeButton = screen.getByTestId('CloseIcon').closest('button')
      fireEvent.click(closeButton)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Stepper de pasos', () => {
    it('debe mostrar los 4 pasos', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByText('Analisis')).toBeInTheDocument()
      expect(screen.getByText('Decision')).toBeInTheDocument()
      expect(screen.getByText('Resumen')).toBeInTheDocument()
      expect(screen.getByText('Acciones')).toBeInTheDocument()
    })

    it('debe mostrar paso 1 como activo inicialmente', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByTestId('paso1')).toBeInTheDocument()
    })
  })

  describe('Navegacion entre pasos', () => {
    it('debe pasar a paso 2 al continuar desde paso 1', async () => {
      await renderAndWaitForLoad()

      fireEvent.click(screen.getByText('Continuar Paso1'))

      await waitFor(() => {
        expect(screen.getByTestId('paso2')).toBeInTheDocument()
      })
    })

    it('debe volver a paso 1 desde paso 2', async () => {
      await renderAndWaitForLoad()

      fireEvent.click(screen.getByText('Continuar Paso1'))

      await waitFor(() => {
        expect(screen.getByTestId('paso2')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Volver Paso2'))

      await waitFor(() => {
        expect(screen.getByTestId('paso1')).toBeInTheDocument()
      })
    })
  })

  describe('Modal de rechazo', () => {
    it('debe abrir modal de rechazo al hacer clic', async () => {
      await renderAndWaitForLoad()

      fireEvent.click(screen.getByText('Rechazar Paso1'))

      expect(screen.getByText(/Rechazar Solicitud/)).toBeInTheDocument()
    })

    it('debe mostrar campo de motivo de rechazo', async () => {
      await renderAndWaitForLoad()

      fireEvent.click(screen.getByText('Rechazar Paso1'))

      expect(screen.getByText('Motivo del rechazo')).toBeInTheDocument()
    })

    it('debe cerrar modal de rechazo con Cancelar', async () => {
      await renderAndWaitForLoad()

      fireEvent.click(screen.getByText('Rechazar Paso1'))
      expect(screen.getByText(/Rechazar Solicitud/)).toBeInTheDocument()

      const cancelButtons = screen.getAllByText('Cancelar')
      fireEvent.click(cancelButtons[0])

      expect(screen.queryByText('Motivo del rechazo')).not.toBeInTheDocument()
    })
  })

  describe('Modal de solicitud de informacion', () => {
    it('debe abrir modal de solicitud de info', async () => {
      await renderAndWaitForLoad()

      fireEvent.click(screen.getByText('Info Paso1'))

      expect(screen.getByText(/Solicitar Informaci/)).toBeInTheDocument()
    })

    it('debe mostrar campo de solicitud', async () => {
      await renderAndWaitForLoad()

      fireEvent.click(screen.getByText('Info Paso1'))

      expect(screen.getByText(/inform.*necesita/i)).toBeInTheDocument()
    })
  })

  describe('Botones del footer', () => {
    it('debe deshabilitar Anterior en paso 1', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByText('Anterior')).toBeDisabled()
    })

    it('debe mostrar Siguiente en paso 1', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByText('Siguiente')).toBeInTheDocument()
    })
  })

  describe('Carga de analisis', () => {
    it('debe llamar API al montar con solicitud abierta', async () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/planificador/solicitudes/1/analizar'
        )
      })
    })

    it('debe mostrar error cuando la API falla', async () => {
      api.post.mockRejectedValueOnce(new Error('Error de red'))

      render(<TratarSolicitudModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Error al cargar/)).toBeInTheDocument()
      })
    })
  })

  describe('Auto-guardado de decisiones', () => {
    it('debe verificar localStorage al iniciar', async () => {
      await renderAndWaitForLoad()

      const key = `planner_decisiones_${defaultProps.solicitud.id}`
      expect(localStorage.getItem).toHaveBeenCalledWith(key)
    })
  })

  describe('Cierre del modal', () => {
    it('debe resetear estado al cerrar y reabrir', async () => {
      const { rerender } = render(<TratarSolicitudModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('paso1')).toBeInTheDocument()
      })

      rerender(<TratarSolicitudModal {...defaultProps} isOpen={false} />)

      rerender(<TratarSolicitudModal {...defaultProps} isOpen={true} />)

      await waitFor(() => {
        expect(screen.getByTestId('paso1')).toBeInTheDocument()
      })
    })
  })

  describe('Criticidad', () => {
    it('debe mostrar criticidad de la solicitud', async () => {
      await renderAndWaitForLoad()
      expect(screen.getByText('Normal')).toBeInTheDocument()
    })

    it('debe mostrar criticidad "Alta" cuando corresponde', async () => {
      const props = {
        ...defaultProps,
        solicitud: { ...defaultProps.solicitud, criticidad: 'Alta' },
      }
      await renderAndWaitForLoad(props)
      expect(screen.getByText('Alta')).toBeInTheDocument()
    })
  })
})
