/**
 * Catálogo de materiales: buscador conversacional integrado y gestión de equivalencias en el detalle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CatalogoMateriales from '../CatalogoMateriales'
import { materiales, equivalencias } from '../../services/spm'

vi.mock('../../services/spm', () => ({
  materiales: {
    grupos: vi.fn(),
    buscar: vi.fn(),
    detalle: vi.fn(),
    solicitudes: vi.fn(),
  },
  equivalencias: {
    porMaterial: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
  },
}))

// t estable: el grid recrea sus cellRenderers si cambia
const mockT = (key, fallback) => fallback || key
vi.mock('../../context/i18n', () => ({ useI18n: () => ({ t: mockT }) }))

const mockUser = { id: '1', rol: 'Solicitante' }
vi.mock('../../store/authStore', () => ({
  useUser: () => mockUser,
  useAuthStore: (sel) => (sel ? sel({ user: mockUser }) : { user: mockUser }),
}))

vi.mock('../../components/ui/PageLayout', () => ({
  default: ({ title, actions, children }) => (
    <div>
      <h1>{title}</h1>
      {actions}
      {children}
    </div>
  ),
}))

// Panel conversacional: stub con el boton "Filtrar tabla"
vi.mock('../../components/equivalencias/BuscadorMaterialesPanel', () => ({
  default: ({ onFiltrarTabla }) => (
    <div data-testid="buscador-panel">
      <button onClick={() => onFiltrarTabla('0101-0000080')}>Filtrar tabla</button>
    </div>
  ),
}))

vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs }) => (
    <table>
      <tbody>
        {(rowData || []).map((row) => (
          <tr key={row.codigo}>
            {columnDefs.map((c) => {
              const R = c.cellRenderer
              return <td key={c.field}>{R ? <R value={row[c.field]} data={row} /> : String(row[c.field] ?? '')}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

const MATERIAL = { codigo: '0101-0000080', descripcion: 'BOMBA CENTRIF./REP', unidad_medida: 'UNI', precio_usd: 80 }
const EQUIVS = [
  { id: 7, codigo_original: '0101-0000080', codigo_destino: '0101-0000081', codigo_equivalente: '0101-0000081',
    descripcion_equivalente: 'BOMBA CENTRIF. 2HP', tipo_equivalencia: 'E2_SUPLIBLE', criterio: 'Potencia', motivo: 'Mayor caudal' },
  { id: 8, codigo_original: '0101-0000090', codigo_destino: '0101-0000080', codigo_equivalente: '0101-0000090',
    descripcion_equivalente: 'BOMBA DOSIFICADORA', tipo_equivalencia: 'E1_ESTRICTA', criterio: null, motivo: null },
]

async function abrirDetalle() {
  render(<CatalogoMateriales />)
  fireEvent.click(screen.getByText('Filtrar tabla'))
  fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }))
  return screen.findByText('BOMBA CENTRIF. 2HP')
}

describe('CatalogoMateriales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.rol = 'Solicitante'
    materiales.grupos.mockResolvedValue({ data: { data: [] } })
    materiales.buscar.mockResolvedValue({ data: { data: [MATERIAL] } })
    materiales.detalle.mockResolvedValue({ data: {} })
    materiales.solicitudes.mockResolvedValue({ data: { solicitudes: [] } })
    equivalencias.porMaterial.mockResolvedValue({ data: { equivalencias: EQUIVS } })
  })

  it('muestra el titulo unico y el buscador conversacional', () => {
    render(<CatalogoMateriales />)
    expect(screen.getByRole('heading', { name: 'Catálogo de materiales' })).toBeInTheDocument()
    expect(screen.getByTestId('buscador-panel')).toBeInTheDocument()
  })

  it('"Filtrar tabla" busca el codigo en el catalogo', async () => {
    render(<CatalogoMateriales />)
    fireEvent.click(screen.getByText('Filtrar tabla'))
    await waitFor(() =>
      expect(materiales.buscar).toHaveBeenCalledWith(expect.objectContaining({ codigo: '0101-0000080' }))
    )
    expect(await screen.findByText('BOMBA CENTRIF./REP')).toBeInTheDocument()
  })

  it('el detalle agrupa las equivalencias por tipo; sin permiso no hay gestion', async () => {
    await abrirDetalle()
    expect(equivalencias.porMaterial).toHaveBeenCalledWith('0101-0000080')
    expect(screen.getByText('Suplible (1)')).toBeInTheDocument()
    expect(screen.getByText('Estricta (1)')).toBeInTheDocument()
    expect(screen.getByText(/Potencia/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva equivalencia/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('con rol admin muestra "Nueva equivalencia" y editar/borrar por fila', async () => {
    mockUser.rol = 'Admin'
    await abrirDetalle()
    expect(screen.getByRole('button', { name: /Nueva equivalencia/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(2)
  })

  it('borrar una equivalencia llama a eliminar y recarga', async () => {
    mockUser.rol = 'Admin'
    equivalencias.eliminar.mockResolvedValue({ data: { ok: true } })
    await abrirDetalle()
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])
    const botones = await screen.findAllByRole('button', { name: 'Eliminar' })
    fireEvent.click(botones[botones.length - 1])
    await waitFor(() => expect(equivalencias.eliminar).toHaveBeenCalled())
    await waitFor(() => expect(equivalencias.porMaterial).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Equivalencia eliminada correctamente')).toBeInTheDocument()
  })

  it('editar envia tipo/criterio/motivo con el id de la fila', async () => {
    mockUser.rol = 'Admin'
    equivalencias.actualizar.mockResolvedValue({ data: { ok: true } })
    await abrirDetalle()
    // La primera tarjeta del grupo "Estricta" (orden: E0, E1, E2) es id 8
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Actualizar' }))
    await waitFor(() =>
      expect(equivalencias.actualizar).toHaveBeenCalledWith(8, { tipo_equivalencia: 'E1_ESTRICTA', criterio: '', motivo: '' })
    )
  })
})
