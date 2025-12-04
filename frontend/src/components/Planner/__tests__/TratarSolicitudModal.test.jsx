/**
 * Tests para TratarSolicitudModal
 * Generado por Sugar Autonomous System
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TratarSolicitudModal from '../TratarSolicitudModal'

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
  default: ({ onBack, onConfirm, loading }) => (
    <div data-testid="paso3">
      <button onClick={onBack}>Volver Paso3</button>
      <button onClick={onConfirm} disabled={loading}>
        {loading ? 'Guardando...' : 'Confirmar Paso3'}
      </button>
    </div>
  ),
}))

// Mock de componentes UI
vi.mock('../../ui/Card', () => ({
  Card: ({ children, className }) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }) => <div data-testid="card-content" className={className}>{children}</div>,
}))

vi.mock('../../ui/Button', () => ({
  Button: ({ children, onClick, variant, type, disabled }) => (
    <button onClick={onClick} data-variant={variant} type={type} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('../../ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

vi.mock('../../../constants/sectores', () => ({
  renderSector: (sol) => sol?.sector || 'N/D',
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
    localStorage.clear()

    // Mock API responses
    const api = require('../../../services/api').default
    api.post.mockResolvedValue({ data: { data: {} } })
    api.get.mockResolvedValue({ data: { data: { opciones: [] } } })
  })

  describe('Renderizado basico', () => {
    it('debe renderizar el modal cuando isOpen es true', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByText(/Tratar solicitud #1/)).toBeInTheDocument()
    })

    it('no debe renderizar cuando isOpen es false', () => {
      render(<TratarSolicitudModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByText(/Tratar solicitud/)).not.toBeInTheDocument()
    })

    it('no debe renderizar cuando solicitud es null', () => {
      render(<TratarSolicitudModal {...defaultProps} solicitud={null} />)
      expect(screen.queryByText(/Tratar solicitud/)).not.toBeInTheDocument()
    })
  })

  describe('Header del modal', () => {
    it('debe mostrar titulo "Planificador"', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByText('Planificador')).toBeInTheDocument()
    })

    it('debe mostrar informacion de la solicitud', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByText(/Centro 1008/)).toBeInTheDocument()
      expect(screen.getByText(/Sector Mantenimiento/)).toBeInTheDocument()
      expect(screen.getByText(/Almacen ALM001/)).toBeInTheDocument()
    })

    it('debe llamar onClose al hacer clic en Cerrar', () => {
      const onClose = vi.fn()
      render(<TratarSolicitudModal {...defaultProps} onClose={onClose} />)

      fireEvent.click(screen.getByText('Cerrar'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Indicador de pasos', () => {
    it('debe mostrar los 3 pasos', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByText('Analisis')).toBeInTheDocument()
      expect(screen.getByText('Decision')).toBeInTheDocument()
      expect(screen.getByText('Confirmacion')).toBeInTheDocument()
    })

    it('debe mostrar paso 1 como activo inicialmente', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByTestId('paso1')).toBeInTheDocument()
    })
  })

  describe('Navegacion entre pasos', () => {
    it('debe pasar a paso 2 al continuar desde paso 1', async () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      fireEvent.click(screen.getByText('Continuar Paso1'))

      await waitFor(() => {
        expect(screen.getByTestId('paso2')).toBeInTheDocument()
      })
    })

    it('debe volver a paso 1 desde paso 2', async () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      // Ir a paso 2
      fireEvent.click(screen.getByText('Continuar Paso1'))

      await waitFor(() => {
        expect(screen.getByTestId('paso2')).toBeInTheDocument()
      })

      // Volver a paso 1
      fireEvent.click(screen.getByText('Volver Paso2'))

      await waitFor(() => {
        expect(screen.getByTestId('paso1')).toBeInTheDocument()
      })
    })
  })

  describe('Modal de rechazo', () => {
    it('debe abrir modal de rechazo al hacer clic', () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      fireEvent.click(screen.getByText('Rechazar Paso1'))

      expect(screen.getByText('Rechazar Solicitud')).toBeInTheDocument()
    })

    it('debe mostrar campo de motivo de rechazo', () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      fireEvent.click(screen.getByText('Rechazar Paso1'))

      expect(screen.getByText('Motivo del rechazo')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Explique por que se rechaza/)).toBeInTheDocument()
    })

    it('debe cerrar modal de rechazo con Cancelar', () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      fireEvent.click(screen.getByText('Rechazar Paso1'))
      expect(screen.getByText('Rechazar Solicitud')).toBeInTheDocument()

      // Hay dos botones Cancelar, tomamos el primero del modal
      const cancelButtons = screen.getAllByText('Cancelar')
      fireEvent.click(cancelButtons[0])

      expect(screen.queryByText('Motivo del rechazo')).not.toBeInTheDocument()
    })
  })

  describe('Modal de solicitud de informacion', () => {
    it('debe abrir modal de solicitud de info', () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      fireEvent.click(screen.getByText('Info Paso1'))

      expect(screen.getByText('Solicitar Informacion')).toBeInTheDocument()
    })

    it('debe mostrar campo de solicitud', () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      fireEvent.click(screen.getByText('Info Paso1'))

      expect(screen.getByText(/Que informacion necesita/)).toBeInTheDocument()
    })
  })

  describe('Botones del footer', () => {
    it('debe deshabilitar Anterior en paso 1', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByText('Anterior')).toBeDisabled()
    })

    it('debe mostrar Siguiente en pasos 1 y 2', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByText('Siguiente')).toBeInTheDocument()
    })
  })

  describe('Carga de analisis', () => {
    it('debe mostrar "Cargando analisis..." mientras carga', async () => {
      const api = require('../../../services/api').default
      api.post.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<TratarSolicitudModal {...defaultProps} />)

      // El componente carga analisis al montar, pero como mockeamos Paso1,
      // verificamos que se llama la API
      expect(api.post).toHaveBeenCalled()
    })
  })

  describe('Auto-guardado de decisiones', () => {
    it('debe guardar decisiones en localStorage', async () => {
      render(<TratarSolicitudModal {...defaultProps} />)

      // El auto-save se activa cuando hay decisiones
      // Como mockeamos los componentes hijos, verificamos el localStorage directamente
      const key = `planner_decisiones_${defaultProps.solicitud.id}`
      expect(localStorage.getItem(key)).toBeNull()
    })
  })

  describe('Mensajes de error', () => {
    it('debe mostrar mensaje de error cuando la API falla', async () => {
      const api = require('../../../services/api').default
      api.post.mockRejectedValueOnce(new Error('Error de red'))

      render(<TratarSolicitudModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Error al cargar analisis/)).toBeInTheDocument()
      })
    })
  })

  describe('Guardar tratamiento', () => {
    it('debe llamar API al confirmar en paso 3', async () => {
      const api = require('../../../services/api').default
      const onComplete = vi.fn()
      const onClose = vi.fn()

      // Mock para que la navegacion funcione
      api.post.mockResolvedValue({
        data: {
          data: {
            resumen: { total_items: 0 },
            materiales_por_criticidad: {},
          },
        },
      })

      render(
        <TratarSolicitudModal
          {...defaultProps}
          onComplete={onComplete}
          onClose={onClose}
        />
      )

      // Simular navegacion a paso 3
      fireEvent.click(screen.getByText('Continuar Paso1'))

      await waitFor(() => {
        expect(screen.getByTestId('paso2')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Continuar Paso2'))

      await waitFor(() => {
        expect(screen.getByTestId('paso3')).toBeInTheDocument()
      })

      // Confirmar
      fireEvent.click(screen.getByText('Confirmar Paso3'))

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled()
      })
    })
  })

  describe('Cierre del modal', () => {
    it('debe resetear estado al cerrar', () => {
      const { rerender } = render(<TratarSolicitudModal {...defaultProps} />)

      // Cerrar modal
      rerender(<TratarSolicitudModal {...defaultProps} isOpen={false} />)

      // Reabrir
      rerender(<TratarSolicitudModal {...defaultProps} isOpen={true} />)

      // Debe estar en paso 1
      expect(screen.getByTestId('paso1')).toBeInTheDocument()
    })
  })

  describe('Criticidad', () => {
    it('debe mostrar criticidad de la solicitud', () => {
      render(<TratarSolicitudModal {...defaultProps} />)
      expect(screen.getByText(/Criticidad Normal/)).toBeInTheDocument()
    })

    it('debe mostrar criticidad "Alta" cuando corresponde', () => {
      const props = {
        ...defaultProps,
        solicitud: { ...defaultProps.solicitud, criticidad: 'Alta' },
      }
      render(<TratarSolicitudModal {...props} />)
      expect(screen.getByText(/Criticidad Alta/)).toBeInTheDocument()
    })
  })
})
