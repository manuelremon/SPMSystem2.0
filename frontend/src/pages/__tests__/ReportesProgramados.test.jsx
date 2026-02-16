/**
 * Tests para ReportesProgramados
 * Verifica CRUD de reportes programados, dialogs, validacion y toasts
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ============================================================================
// MOCKS - must be defined before importing the component
// ============================================================================

const stableT = vi.fn((key, fallback) => fallback || key)
const stableI18n = { t: stableT, lang: 'es' }
vi.mock('../../context/i18n', () => ({
  useI18n: () => stableI18n,
}))

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}
vi.mock('../../hooks/useToast', () => ({
  useToast: () => mockToast,
  default: () => mockToast,
}))

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
const mockApiPut = vi.fn()
const mockApiDelete = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
    put: (...args) => mockApiPut(...args),
    delete: (...args) => mockApiDelete(...args),
  },
}))

vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs, loading, emptyMessage }) => (
    <div data-testid="spm-ag-grid">
      {loading ? (
        <span data-testid="grid-loading">Loading...</span>
      ) : rowData?.length > 0 ? (
        <table>
          <thead>
            <tr>
              {columnDefs?.map((col, i) => (
                <th key={i}>{col.headerName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowData.map((row, i) => (
              <tr key={row.id || i} data-testid={`grid-row-${row.id || i}`}>
                <td>{row.nombre}</td>
                <td>{row.tipo}</td>
                <td>{row.frecuencia}</td>
                <td>{row.formato}</td>
                <td>{row.activo ? 'Activo' : 'Inactivo'}</td>
                <td>
                  {columnDefs?.find(c => c.headerName === 'Acciones')?.cellRenderer?.({ data: row })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <span data-testid="grid-empty">{emptyMessage}</span>
      )}
    </div>
  ),
}))

// ============================================================================
// TEST DATA
// ============================================================================

const mockReportes = [
  { id: 1, nombre: 'Reporte Mensual', tipo: 'solicitudes', frecuencia: 'mensual', formato: 'xlsx', activo: 1, ultimo_envio: '2026-02-10T10:00:00Z' },
  { id: 2, nombre: 'Stock Semanal', tipo: 'stock', frecuencia: 'semanal', formato: 'csv', activo: 0, ultimo_envio: null },
]

// ============================================================================
// HELPERS
// ============================================================================

import ReportesProgramados from '../ReportesProgramados'

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportesProgramados />
    </MemoryRouter>
  )
}

// ============================================================================
// TESTS
// ============================================================================

describe('ReportesProgramados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ data: { ok: true, reportes: mockReportes } })
  })

  // --------------------------------------------------------------------------
  // 1. Renders title and "Crear Reporte" button
  // --------------------------------------------------------------------------
  it('renders the page title and create button', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Reportes Programados')).toBeInTheDocument()
    })
    expect(screen.getByText('Crear Reporte')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 2. Renders loading state
  // --------------------------------------------------------------------------
  it('renders loading state while fetching', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(screen.getByTestId('grid-loading')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 3. Renders empty state when no reports
  // --------------------------------------------------------------------------
  it('renders empty state when there are no reports', async () => {
    mockApiGet.mockResolvedValue({ data: { ok: true, reportes: [] } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-empty')).toBeInTheDocument()
    })
    expect(screen.getByText('No hay reportes programados')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 4. Renders reports list with data
  // --------------------------------------------------------------------------
  it('renders reports list after fetching data', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('grid-row-2')).toBeInTheDocument()
    expect(screen.getByText('Reporte Mensual')).toBeInTheDocument()
    expect(screen.getByText('Stock Semanal')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 5. Opens create dialog when clicking "Crear Reporte"
  // --------------------------------------------------------------------------
  it('opens create dialog on clicking Crear Reporte button', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Reporte'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Reporte Programado')).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // 6. Dialog has all form fields
  // --------------------------------------------------------------------------
  it('shows all form fields in the create dialog', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Reporte'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Reporte Programado')).toBeInTheDocument()
    })
    // Scope assertions to the dialog
    const dialog = screen.getByText('Nuevo Reporte Programado').closest('[role="dialog"]')
    // Name field
    expect(within(dialog).getByLabelText(/Nombre/)).toBeInTheDocument()
    // Tipo de Reporte select (label + selected value can match, use getAllByText)
    expect(within(dialog).getAllByText('Tipo de Reporte').length).toBeGreaterThan(0)
    // Frecuencia select
    expect(within(dialog).getAllByText('Frecuencia').length).toBeGreaterThan(0)
    // Formato select
    expect(within(dialog).getAllByText('Formato').length).toBeGreaterThan(0)
    // Destinatarios field
    expect(within(dialog).getByLabelText(/Destinatarios/)).toBeInTheDocument()
    // Activo switch
    expect(within(dialog).getByText('Activo')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 7. Can close dialog with Cancel button
  // --------------------------------------------------------------------------
  it('closes the dialog when Cancel is clicked', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Reporte'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Reporte Programado')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancelar'))
    await waitFor(() => {
      expect(screen.queryByText('Nuevo Reporte Programado')).not.toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // 8. Validates required name field
  // --------------------------------------------------------------------------
  it('shows warning when trying to save with empty name', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Reporte'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Reporte Programado')).toBeInTheDocument()
    })
    // The "Crear" button inside dialog should be disabled when name is empty
    const dialog = screen.getByText('Nuevo Reporte Programado').closest('[role="dialog"]')
    const buttons = within(dialog).getAllByRole('button')
    const crearBtn = buttons.find(btn => btn.textContent === 'Crear')
    expect(crearBtn).toBeDisabled()
  })

  // --------------------------------------------------------------------------
  // 9. Creates new report
  // --------------------------------------------------------------------------
  it('creates a new report with correct payload', async () => {
    mockApiPost.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Reporte'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Reporte Programado')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/Nombre/)
    fireEvent.change(nameInput, { target: { value: 'Mi Nuevo Reporte' } })

    const dialog = screen.getByText('Nuevo Reporte Programado').closest('[role="dialog"]')
    const crearBtn = within(dialog).getAllByRole('button').find(btn => btn.textContent === 'Crear')
    fireEvent.click(crearBtn)

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/export/programados', expect.objectContaining({
        nombre: 'Mi Nuevo Reporte',
        tipo: 'solicitudes',
        frecuencia: 'manual',
        formato: 'xlsx',
        activo: 1,
      }))
    })
  })

  // --------------------------------------------------------------------------
  // 10. Opens edit dialog with existing data
  // --------------------------------------------------------------------------
  it('opens edit dialog with existing report data', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    // Click the edit button for the first report via aria-label
    const editButtons = screen.getAllByLabelText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Editar Reporte')).toBeInTheDocument()
    })
    // The name field should be pre-filled
    const nameInput = screen.getByLabelText(/Nombre/)
    expect(nameInput.value).toBe('Reporte Mensual')
  })

  // --------------------------------------------------------------------------
  // 11. Updates existing report
  // --------------------------------------------------------------------------
  it('updates an existing report calling api.put', async () => {
    mockApiPut.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByLabelText('Editar')
    fireEvent.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByText('Editar Reporte')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/Nombre/)
    fireEvent.change(nameInput, { target: { value: 'Reporte Editado' } })

    const dialog = screen.getByText('Editar Reporte').closest('[role="dialog"]')
    const guardarBtn = within(dialog).getAllByRole('button').find(btn => btn.textContent === 'Guardar')
    fireEvent.click(guardarBtn)

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/export/programados/1', expect.objectContaining({
        nombre: 'Reporte Editado',
      }))
    })
  })

  // --------------------------------------------------------------------------
  // 12. Delete button opens confirmation dialog
  // --------------------------------------------------------------------------
  it('opens confirmation dialog when clicking delete', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByLabelText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Eliminar este reporte programado/)).toBeInTheDocument()
    })
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 13. Confirm delete calls api.delete
  // --------------------------------------------------------------------------
  it('confirms delete and calls api.delete', async () => {
    mockApiDelete.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByLabelText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Eliminar este reporte programado/)).toBeInTheDocument()
    })

    // The confirmation dialog has an "Eliminar" button
    const confirmDialog = screen.getByText(/Eliminar este reporte programado/).closest('[role="dialog"]')
    const eliminarBtn = within(confirmDialog).getAllByRole('button').find(btn => btn.textContent === 'Eliminar')
    fireEvent.click(eliminarBtn)

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/export/programados/1')
    })
  })

  // --------------------------------------------------------------------------
  // 14. Cancel delete closes confirmation dialog
  // --------------------------------------------------------------------------
  it('cancels delete and closes confirmation dialog', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByLabelText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Eliminar este reporte programado/)).toBeInTheDocument()
    })

    const confirmDialog = screen.getByText(/Eliminar este reporte programado/).closest('[role="dialog"]')
    const cancelBtn = within(confirmDialog).getAllByRole('button').find(btn => btn.textContent === 'Cancelar')
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Eliminar este reporte programado/)).not.toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // 15. Execute report calls api.post with blob response
  // --------------------------------------------------------------------------
  it('executes a report calling api.post with blob responseType', async () => {
    // Mock createObjectURL and createElement for the download flow
    const mockUrl = 'blob:http://localhost/fake'
    window.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl)
    window.URL.revokeObjectURL = vi.fn()
    const mockClick = vi.fn()
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { href: '', download: '', click: mockClick }
      }
      return origCreateElement(tag)
    })

    mockApiPost.mockResolvedValue({
      data: new Blob(['file content']),
      headers: { 'content-disposition': 'attachment; filename="reporte_1.xlsx"' },
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })

    const executeButtons = screen.getAllByLabelText('Ejecutar ahora')
    fireEvent.click(executeButtons[0])

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/export/programados/1/ejecutar',
        {},
        { responseType: 'blob' }
      )
    })

    // Restore
    document.createElement.mockRestore()
  })

  // --------------------------------------------------------------------------
  // 16. Shows error toast on fetch failure
  // --------------------------------------------------------------------------
  it('shows error toast when fetch fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar reportes programados')
    })
  })

  // --------------------------------------------------------------------------
  // 17. Shows error toast on save failure
  // --------------------------------------------------------------------------
  it('shows error toast when save fails', async () => {
    mockApiPost.mockRejectedValue({ response: { data: { error: 'Server error' } } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Reporte'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Reporte Programado')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/Nombre/)
    fireEvent.change(nameInput, { target: { value: 'Test' } })

    const dialog = screen.getByText('Nuevo Reporte Programado').closest('[role="dialog"]')
    const crearBtn = within(dialog).getAllByRole('button').find(btn => btn.textContent === 'Crear')
    fireEvent.click(crearBtn)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Server error')
    })
  })

  // --------------------------------------------------------------------------
  // 18. Shows success toast on create
  // --------------------------------------------------------------------------
  it('shows success toast after creating a report', async () => {
    mockApiPost.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Crear Reporte'))
    await waitFor(() => {
      expect(screen.getByText('Nuevo Reporte Programado')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/Nombre/)
    fireEvent.change(nameInput, { target: { value: 'Nuevo' } })

    const dialog = screen.getByText('Nuevo Reporte Programado').closest('[role="dialog"]')
    const crearBtn = within(dialog).getAllByRole('button').find(btn => btn.textContent === 'Crear')
    fireEvent.click(crearBtn)

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Reporte creado')
    })
  })

  // --------------------------------------------------------------------------
  // 19. Shows success toast on delete
  // --------------------------------------------------------------------------
  it('shows success toast after deleting a report', async () => {
    mockApiDelete.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByLabelText('Eliminar')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByText(/Eliminar este reporte programado/)).toBeInTheDocument()
    })

    const confirmDialog = screen.getByText(/Eliminar este reporte programado/).closest('[role="dialog"]')
    const eliminarBtn = within(confirmDialog).getAllByRole('button').find(btn => btn.textContent === 'Eliminar')
    fireEvent.click(eliminarBtn)

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Reporte eliminado')
    })
  })

  // --------------------------------------------------------------------------
  // 20. Renders column headers correctly
  // --------------------------------------------------------------------------
  it('renders all column headers from the grid', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    const expectedHeaders = ['Nombre', 'Tipo', 'Frecuencia', 'Formato', 'Estado', 'Acciones']
    for (const header of expectedHeaders) {
      expect(screen.getByText(header, { selector: 'th' })).toBeInTheDocument()
    }
  })
})
