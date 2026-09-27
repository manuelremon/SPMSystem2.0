/**
 * Consumo historico: tarjetas + tabla, toggle detalle/material y filtro de centro.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import ConsumoHistorico from '../ConsumoHistorico'
import { consumoHistorico } from '../../services/spm'

vi.mock('../../services/spm', () => ({
  consumoHistorico: { listar: vi.fn() },
}))

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}))

vi.mock('../../components/ui/PageLayout', () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
}))

vi.mock('../../components/ui/SPMChartJS', () => ({
  SPMBar: () => <div data-testid="chart-mensual" />,
}))

// SPMAgGrid: renderiza cada celda con su valueFormatter, y expone onRowClick
vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs, onRowClick }) => (
    <table>
      <thead>
        <tr>{columnDefs.map((c) => <th key={c.field}>{c.headerName}</th>)}</tr>
      </thead>
      <tbody>
        {(rowData || []).map((row, i) => (
          <tr key={row.material + i} onClick={() => onRowClick && onRowClick(row)} data-testid={`fila-${row.material}`}>
            {columnDefs.map((c) => {
              const value = row[c.field]
              const formatted = c.valueFormatter ? c.valueFormatter({ value, data: row }) : value
              return <td key={c.field}>{String(formatted ?? '')}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

const RESPUESTA_BASE = {
  ok: true,
  data: [
    { fecha: '2024-02-11', centro: 'AA101', almacen: '0001', material: 'M3',
      descripcion: 'MATERIAL TRES', cantidad: 7, unidad: 'UNI', precio_usd: 4, valor_usd: 28 },
    { fecha: '2024-01-15', centro: 'AA101', almacen: '0001', material: 'M1',
      descripcion: 'MATERIAL UNO', cantidad: 10, unidad: 'UNI', precio_usd: 2.5, valor_usd: 25 },
  ],
  truncado: false,
  resumen: { movimientos: 4, cantidad_total: 25, materiales: 3, valor_usd: 65.5, desde: null, hasta: null },
  mensual: [
    { mes: '2024-01', movimientos: 2, cantidad: 15, valor_usd: 37.5 },
    { mes: '2024-02', movimientos: 2, cantidad: 10, valor_usd: 28 },
  ],
  rango_datos: { min: '2024-01-15', max: '2024-02-11' },
  filtros: { centros: ['AA101', 'AA102'], almacenes: ['0001', '0012'] },
}

const RESPUESTA_MATERIAL = {
  ...RESPUESTA_BASE,
  data: [
    { material: 'M1', descripcion: 'MATERIAL UNO', unidad: 'UNI', movimientos: 2, cantidad_total: 15,
      primer_consumo: '2024-01-15', ultimo_consumo: '2024-01-20', precio_usd: 2.5, valor_usd: 37.5 },
    { material: 'M2', descripcion: 'MATERIAL DOS', unidad: 'UNI', movimientos: 1, cantidad_total: 3,
      primer_consumo: '2024-02-10', ultimo_consumo: '2024-02-10', precio_usd: null, valor_usd: null },
  ],
}

describe('ConsumoHistorico', () => {
  beforeEach(() => {
    consumoHistorico.listar.mockReset()
    consumoHistorico.listar.mockResolvedValue({ data: RESPUESTA_BASE })
  })

  it('renderiza tarjetas resumen y la tabla de detalle', async () => {
    render(<ConsumoHistorico />)

    await waitFor(() => expect(screen.getByText('Consumo histórico')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('fila-M3')).toBeInTheDocument())

    expect(screen.getByText('Movimientos')).toBeInTheDocument()
    expect(screen.getByText('Materiales distintos')).toBeInTheDocument()
    expect(screen.getByTestId('fila-M1')).toBeInTheDocument()
  })

  it('cambiar a "Por material" pide agrupar=material', async () => {
    consumoHistorico.listar.mockImplementation((params = {}) =>
      Promise.resolve({ data: params.agrupar === 'material' ? RESPUESTA_MATERIAL : RESPUESTA_BASE })
    )

    render(<ConsumoHistorico />)
    await waitFor(() => expect(screen.getByTestId('fila-M3')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Por material'))

    await waitFor(() => {
      const llamadas = consumoHistorico.listar.mock.calls
      expect(llamadas.some(([params]) => params.agrupar === 'material')).toBe(true)
    })
  })

  it('aplicar filtro de centro envía el parámetro centro', async () => {
    render(<ConsumoHistorico />)
    await waitFor(() => expect(screen.getByTestId('fila-M3')).toBeInTheDocument())

    // MUI Select: mouseDown en el combobox (id `mui-component-select-{name}`) abre el listbox
    fireEvent.mouseDown(document.getElementById('mui-component-select-centro'))
    const listbox = await screen.findByRole('listbox')
    fireEvent.click(within(listbox).getByText('AA101'))

    await waitFor(() => {
      const llamadas = consumoHistorico.listar.mock.calls
      expect(llamadas.some(([params]) => params.centro === 'AA101')).toBe(true)
    })
  })
})
