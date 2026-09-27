import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BuscadorMaterialesPanel from '../BuscadorMaterialesPanel'
import { equivalencias } from '../../../services/spm'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../services/spm', () => ({
  equivalencias: { asistente: vi.fn() },
  solicitudes: { listar: vi.fn().mockResolvedValue({ data: { solicitudes: [] } }), obtener: vi.fn(), guardarBorrador: vi.fn() },
}))
const mockUser = { id: '901', rol: 'Solicitante' }
vi.mock('../../../store/authStore', () => ({
  useUser: () => mockUser,
  useAuthStore: (sel) => sel({ user: mockUser }),
}))
const mockT = (key, fallback) => fallback || key
vi.mock('../../../context/i18n', () => ({ useI18n: () => ({ t: mockT }) }))

const RESP_DESC = {
  ok: true, intencion: 'descripcion', consulta: 'bomba centrífuga', sugerencias: ['equivalentes de 0101-0000080'], equivalencias: null,
  materiales: [{ codigo: '0101-0000080', descripcion: 'BOMBA CENTRIF./REP', unidad: 'UNI', precio_usd: 80.87, cant_equivalencias: 2 }],
}

describe('BuscadorMaterialesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.rol = 'Solicitante'
  })

  it('muestra saludo con 3 ejemplos', () => {
    render(<BuscadorMaterialesPanel onFiltrarTabla={vi.fn()} />)
    expect(screen.getByText(/Describe el material que buscas/)).toBeInTheDocument()
    expect(screen.getAllByTestId('equiv-bot-ejemplo')).toHaveLength(3)
  })

  it('un ejemplo dispara la busqueda y muestra tarjetas', async () => {
    equivalencias.asistente.mockResolvedValue({ data: RESP_DESC })
    render(<BuscadorMaterialesPanel onFiltrarTabla={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('equiv-bot-ejemplo')[0])
    expect(await screen.findByText('BOMBA CENTRIF./REP')).toBeInTheDocument()
    expect(equivalencias.asistente).toHaveBeenCalledWith('bomba centrífuga')
    expect(screen.getByText(/Encontré 1 materiales/)).toBeInTheDocument()
  })

  it('Enter envia el texto escrito y Ver equivalentes consulta el codigo', async () => {
    equivalencias.asistente.mockResolvedValue({ data: RESP_DESC })
    render(<BuscadorMaterialesPanel onFiltrarTabla={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'bomba' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('button', { name: /Ver equivalentes/ }))
    await waitFor(() => expect(equivalencias.asistente).toHaveBeenLastCalledWith('equivalentes de 0101-0000080'))
  })

  it('Filtrar tabla llama a onFiltrarTabla', async () => {
    equivalencias.asistente.mockResolvedValue({ data: RESP_DESC })
    const onFiltrarTabla = vi.fn()
    render(<BuscadorMaterialesPanel onFiltrarTabla={onFiltrarTabla} />)
    fireEvent.click(screen.getAllByTestId('equiv-bot-ejemplo')[0])
    fireEvent.click(await screen.findByRole('button', { name: /Filtrar tabla/ }))
    expect(onFiltrarTabla).toHaveBeenCalledWith('0101-0000080')
  })

  it('rol Compartidos no ve Agregar a solicitud; Solicitante si', async () => {
    equivalencias.asistente.mockResolvedValue({ data: RESP_DESC })
    mockUser.rol = 'Compartidos'
    const { unmount } = render(<BuscadorMaterialesPanel onFiltrarTabla={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('equiv-bot-ejemplo')[0])
    await screen.findByText('BOMBA CENTRIF./REP')
    expect(screen.queryByRole('button', { name: /Agregar a solicitud/ })).not.toBeInTheDocument()
    unmount()

    mockUser.rol = 'Solicitante'
    render(<BuscadorMaterialesPanel onFiltrarTabla={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('equiv-bot-ejemplo')[0])
    expect(await screen.findByRole('button', { name: /Agregar a solicitud/ })).toBeInTheDocument()
  })

  it('error muestra Reintentar y reintenta', async () => {
    equivalencias.asistente.mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce({ data: RESP_DESC })
    render(<BuscadorMaterialesPanel onFiltrarTabla={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('equiv-bot-ejemplo')[0])
    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByText('BOMBA CENTRIF./REP')).toBeInTheDocument()
  })
})
