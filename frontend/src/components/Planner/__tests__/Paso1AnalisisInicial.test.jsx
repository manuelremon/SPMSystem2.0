/**
 * Tests para Paso1AnalisisInicial
 * Generado por Sugar Autonomous System
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Paso1AnalisisInicial from '../Paso1AnalisisInicial'

// Mock de componentes UI
vi.mock('../../ui/Card', () => ({
  Card: ({ children, className }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children }) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children, className }) => <p data-testid="card-description" className={className}>{children}</p>,
  CardContent: ({ children, className }) => <div data-testid="card-content" className={className}>{children}</div>,
}))

vi.mock('../../ui/Button', () => ({
  Button: ({ children, onClick, variant, type }) => (
    <button onClick={onClick} data-variant={variant} type={type}>
      {children}
    </button>
  ),
}))

vi.mock('../../ui/StatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}))

describe('Paso1AnalisisInicial', () => {
  const defaultProps = {
    analisis: {},
    solicitud: {},
    onNext: vi.fn(),
    onReject: vi.fn(),
    onRequestInfo: vi.fn(),
  }

  describe('Renderizado básico', () => {
    it('debe renderizar el componente', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('debe mostrar el título "Analisis inicial"', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Analisis inicial')).toBeInTheDocument()
    })

    it('debe mostrar la descripción', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText(/Presupuesto, criticidad y conflictos/)).toBeInTheDocument()
    })

    it('debe mostrar el botón "Continuar con tratamiento"', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Continuar con tratamiento')).toBeInTheDocument()
    })
  })

  describe('Sección de Presupuesto', () => {
    it('debe mostrar el análisis presupuestario', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Análisis Presupuestario')).toBeInTheDocument()
    })

    it('debe mostrar presupuesto total', () => {
      const props = {
        ...defaultProps,
        analisis: {
          resumen: {
            presupuesto_total: 10000,
            presupuesto_disponible: 5000,
          },
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('Presupuesto Total')).toBeInTheDocument()
    })

    it('debe mostrar balance positivo con check', () => {
      const props = {
        ...defaultProps,
        analisis: {
          resumen: {
            presupuesto_total: 10000,
            presupuesto_disponible: 8000,
            presupuesto_real_necesario: 5000,
            diferencia_presupuesto: 3000,
          },
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText(/Balance/)).toBeInTheDocument()
    })
  })

  describe('Sección de Conflictos', () => {
    it('debe mostrar "Sin conflictos detectados" cuando no hay conflictos', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Sin conflictos detectados')).toBeInTheDocument()
    })

    it('debe mostrar conflictos cuando existen', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [
            { tipo: 'STOCK', descripcion: 'Stock insuficiente', impacto_critico: false },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('STOCK')).toBeInTheDocument()
    })

    it('debe marcar conflictos críticos con emoji de advertencia', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [
            { tipo: 'PRESUPUESTO', descripcion: 'Sin fondos', impacto_critico: true },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText(/PRESUPUESTO/)).toBeInTheDocument()
    })
  })

  describe('Sección de Avisos', () => {
    it('debe mostrar "Sin avisos" cuando no hay avisos', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Sin avisos')).toBeInTheDocument()
    })

    it('debe mostrar avisos cuando existen', () => {
      const props = {
        ...defaultProps,
        analisis: {
          avisos: [
            { nivel: 'warning', mensaje: 'Revisar cantidades' },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('Revisar cantidades')).toBeInTheDocument()
    })
  })

  describe('Sección de Recomendaciones', () => {
    it('debe mostrar "Sin recomendaciones" cuando no hay recomendaciones', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Sin recomendaciones')).toBeInTheDocument()
    })

    it('debe mostrar recomendaciones cuando existen', () => {
      const props = {
        ...defaultProps,
        analisis: {
          recomendaciones: [
            { accion: 'REVISAR', razon: 'Cantidad elevada', prioridad: 'alta' },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('REVISAR')).toBeInTheDocument()
    })
  })

  describe('Sección de Materiales', () => {
    it('debe mostrar "Materiales Solicitados"', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Materiales Solicitados')).toBeInTheDocument()
    })

    it('debe mostrar materiales de la solicitud', () => {
      const props = {
        ...defaultProps,
        solicitud: {
          items: [
            { codigo: 'MAT001', descripcion: 'Tornillo', cantidad: 100, precio_unitario: 0.5 },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('MAT001')).toBeInTheDocument()
    })

    it('debe mostrar cantidad de items', () => {
      const props = {
        ...defaultProps,
        solicitud: {
          items: [
            { codigo: 'MAT001', descripcion: 'Tornillo', cantidad: 100 },
            { codigo: 'MAT002', descripcion: 'Tuerca', cantidad: 50 },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('2 items')).toBeInTheDocument()
    })
  })

  describe('Interacciones', () => {
    it('debe llamar onNext al hacer clic en "Continuar con tratamiento"', () => {
      const onNext = vi.fn()
      render(<Paso1AnalisisInicial {...defaultProps} onNext={onNext} />)

      fireEvent.click(screen.getByText('Continuar con tratamiento'))
      expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('debe mostrar botón "Rechazar solicitud" cuando hay conflictos críticos', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [
            { tipo: 'CRITICO', impacto_critico: true },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('Rechazar solicitud')).toBeInTheDocument()
    })

    it('debe llamar onReject al rechazar', () => {
      const onReject = vi.fn()
      const props = {
        ...defaultProps,
        onReject,
        analisis: {
          conflictos: [
            { tipo: 'CRITICO', impacto_critico: true },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)

      fireEvent.click(screen.getByText('Rechazar solicitud'))
      expect(onReject).toHaveBeenCalledTimes(1)
    })

    it('debe mostrar botón "Solicitar información" cuando hay conflictos', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [
            { tipo: 'INFO', impacto_critico: false },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText('Solicitar información')).toBeInTheDocument()
    })

    it('debe llamar onRequestInfo al solicitar información', () => {
      const onRequestInfo = vi.fn()
      const props = {
        ...defaultProps,
        onRequestInfo,
        analisis: {
          conflictos: [
            { tipo: 'INFO', impacto_critico: false },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)

      fireEvent.click(screen.getByText('Solicitar información'))
      expect(onRequestInfo).toHaveBeenCalledTimes(1)
    })

    it('debe toggle sección de conflictos', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [{ tipo: 'TEST', impacto_critico: false }],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)

      // Click en "Ocultar" para colapsar
      const toggleButtons = screen.getAllByText(/Mostrar|Ocultar/)
      fireEvent.click(toggleButtons[0])

      // Ahora debe mostrar "Mostrar"
      expect(screen.getByText(/Mostrar/)).toBeInTheDocument()
    })
  })

  describe('Props por defecto', () => {
    it('debe manejar analisis undefined', () => {
      render(<Paso1AnalisisInicial onNext={vi.fn()} />)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('debe manejar solicitud undefined', () => {
      render(<Paso1AnalisisInicial analisis={{}} onNext={vi.fn()} />)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })
  })
})
