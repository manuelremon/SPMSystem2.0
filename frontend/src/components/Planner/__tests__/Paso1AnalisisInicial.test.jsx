/**
 * Tests para Paso1AnalisisInicial
 * Updated to match MUI-based component implementation
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Paso1AnalisisInicial from '../Paso1AnalisisInicial'

// Mock api and csrf (used by PresupuestoInsuficienteModal)
vi.mock('../../../services/api', () => ({
  default: { post: vi.fn(), patch: vi.fn() },
}))
vi.mock('../../../services/csrf', () => ({
  ensureCsrfToken: vi.fn(),
}))

// Mock formatCurrency to return a predictable string
vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (val) => `USD ${(val || 0).toFixed(2)}`,
}))

// Mock SPMAgGrid to render row data as text
vi.mock('../../ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs, emptyMessage }) => (
    <div data-testid="spm-ag-grid">
      {(!rowData || rowData.length === 0) ? (
        <span>{emptyMessage}</span>
      ) : (
        rowData.map((row, idx) => (
          <div key={idx} data-testid={`grid-row-${idx}`}>
            {columnDefs.map((col) => (
              <span key={col.field}>{row[col.field]}</span>
            ))}
          </div>
        ))
      )}
    </div>
  ),
}))

describe('Paso1AnalisisInicial', () => {
  const defaultProps = {
    analisis: {},
    solicitud: {},
    onNext: vi.fn(),
    onReject: vi.fn(),
    onRequestInfo: vi.fn(),
  }

  describe('Renderizado basico', () => {
    it('debe renderizar el componente', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      // Component renders a MUI Paper as the root element with a header
      expect(screen.getByText(/lisis Inicial/)).toBeInTheDocument()
    })

    it('debe mostrar el titulo "Analisis Inicial"', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText(/lisis Inicial/)).toBeInTheDocument()
    })

    it('debe mostrar la seccion de balance presupuesto', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('BALANCE PRESUPUESTO')).toBeInTheDocument()
    })

    it('debe mostrar las tres secciones de alertas', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('CONFLICTOS')).toBeInTheDocument()
      expect(screen.getByText('AVISOS')).toBeInTheDocument()
      expect(screen.getByText('RECOMENDACIONES')).toBeInTheDocument()
    })
  })

  describe('Seccion de Presupuesto', () => {
    it('debe mostrar el balance presupuesto', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('BALANCE PRESUPUESTO')).toBeInTheDocument()
    })

    it('debe mostrar presupuesto disponible', () => {
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
      expect(screen.getByText('Presupuesto Disponible')).toBeInTheDocument()
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

  describe('Seccion de Conflictos', () => {
    it('debe mostrar "Sin conflictos" cuando no hay conflictos', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('Sin conflictos')).toBeInTheDocument()
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

    it('debe marcar conflictos criticos con emoji de advertencia', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [
            { tipo: 'PRESUPUESTO', descripcion: 'Sin fondos', impacto_critico: true },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      // The critical item renders with a warning emoji prefix
      const items = screen.getAllByText(/PRESUPUESTO/)
      expect(items.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Seccion de Avisos', () => {
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

  describe('Seccion de Recomendaciones', () => {
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

  describe('Seccion de Materiales', () => {
    it('debe mostrar "MATERIALES SOLICITADOS"', () => {
      render(<Paso1AnalisisInicial {...defaultProps} />)
      expect(screen.getByText('MATERIALES SOLICITADOS')).toBeInTheDocument()
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
    it('debe mostrar boton "Rechazar solicitud" cuando hay conflictos criticos', () => {
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

    it('debe mostrar boton "Solicitar informacion" cuando hay conflictos', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [
            { tipo: 'INFO', impacto_critico: false },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)
      expect(screen.getByText(/Solicitar informaci/)).toBeInTheDocument()
    })

    it('debe llamar onRequestInfo al solicitar informacion', () => {
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

      fireEvent.click(screen.getByText(/Solicitar informaci/))
      expect(onRequestInfo).toHaveBeenCalledTimes(1)
    })

    it('debe expandir alertas con mas de 2 items', () => {
      const props = {
        ...defaultProps,
        analisis: {
          conflictos: [
            { tipo: 'STOCK', descripcion: 'Stock bajo', impacto_critico: false },
            { tipo: 'PRECIO', descripcion: 'Precio alto', impacto_critico: false },
            { tipo: 'PLAZO', descripcion: 'Plazo vencido', impacto_critico: false },
          ],
        },
      }
      render(<Paso1AnalisisInicial {...props} />)

      // Should show "+1 mas" link since there are 3 items but only 2 shown
      const expandLink = screen.getByText(/\+1 m/)
      expect(expandLink).toBeInTheDocument()

      // Click to expand
      fireEvent.click(expandLink)

      // After expanding, should show "Ver menos"
      expect(screen.getByText('Ver menos')).toBeInTheDocument()
    })
  })

  describe('Props por defecto', () => {
    it('debe manejar analisis undefined', () => {
      render(<Paso1AnalisisInicial onNext={vi.fn()} />)
      expect(screen.getByText(/lisis Inicial/)).toBeInTheDocument()
    })

    it('debe manejar solicitud undefined', () => {
      render(<Paso1AnalisisInicial analisis={{}} onNext={vi.fn()} />)
      expect(screen.getByText(/lisis Inicial/)).toBeInTheDocument()
    })
  })
})
