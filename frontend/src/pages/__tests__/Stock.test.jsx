/**
 * Stock masivo: inmovilizado con fecha de corte y "Sin consumo" en lugar de 999.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Stock from '../Stock'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}))

vi.mock('../../components/ui/PageLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

// SPMAgGrid: renderiza cada celda con su cellRenderer / valueFormatter
vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs }) => (
    <table>
      <thead>
        <tr>{columnDefs.map((c) => <th key={c.field}>{c.headerName}</th>)}</tr>
      </thead>
      <tbody>
        {(rowData || []).map((row) => (
          <tr key={row.material}>
            {columnDefs.map((c) => {
              const value = row[c.field]
              const R = c.cellRenderer
              return (
                <td key={c.field} data-testid={`${row.material}-${c.field}`}>
                  {R ? <R value={value} data={row} /> : String(value ?? '')}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

const FILAS = [
  { material: 'A', descripcion: 'Con consumo', centro: 'C1', almacen: 'W1', stock: 1, stock_valorizado: 10,
    inmovilizado: false, inmovilizado_sap: true, mrp: false, dias_sin_movimiento: 190 },
  { material: 'C', descripcion: 'Nunca consumio', centro: 'C1', almacen: 'W2', stock: 2, stock_valorizado: 100,
    inmovilizado: true, inmovilizado_sap: false, mrp: false, dias_sin_movimiento: null },
]

describe('Stock', () => {
  beforeEach(() => {
    api.get.mockImplementation((url) => {
      if (url === '/stock/resumen') {
        return Promise.resolve({ data: { ok: true, data: {
          total_items: 2, stock_total: 3, valor_total: 110, inmovilizado_items: 1, inmovilizado_valor: 100,
          mrp_items: 0, sin_consumo_365d: 1, fecha_corte: '2025-07-19',
        } } })
      }
      return Promise.resolve({ data: { ok: true, data: FILAS, total: 2, fecha_corte: '2025-07-19',
        filtros: { centros: ['C1'], almacenes: ['W1', 'W2'] } } })
    })
  })

  it('muestra "Sin consumo" cuando no hay dias y la fecha de corte', async () => {
    render(<Stock />)
    await waitFor(() => expect(screen.getByTestId('C-dias_sin_movimiento')).toBeInTheDocument())
    expect(screen.getByTestId('C-dias_sin_movimiento')).toHaveTextContent('Sin consumo')
    expect(screen.getByTestId('A-dias_sin_movimiento')).toHaveTextContent('190')
    expect(screen.getByText('Sin consumo 12 meses')).toBeInTheDocument()
    expect(screen.getAllByText(/al 19\/07\/2025/).length).toBeGreaterThan(0)
    expect(screen.getByText(/fecha de corte del stock \(19\/07\/2025\)/)).toBeInTheDocument()
    expect(screen.getByText('Marca SAP')).toBeInTheDocument()
  })
})
