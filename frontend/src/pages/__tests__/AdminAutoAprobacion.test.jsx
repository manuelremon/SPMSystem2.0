/**
 * Tests para AdminAutoAprobacion
 * Verifica CRUD de reglas de auto-aprobacion, dialogs, validacion, simulacion y toasts
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ============================================================================
// MOCKS - must be defined before importing the component
// ============================================================================

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
    lang: 'es',
  }),
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
                <td>{row.prioridad}</td>
                <td>{row.centro_id || 'Todos'}</td>
                <td>{row.activo ? 'Activa' : 'Inactiva'}</td>
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

const mockRules = [
  {
    id: 1,
    nombre: 'Regla bajo monto',
    descripcion: 'Auto-aprueba solicitudes <10K',
    activo: 1,
    centro_id: 'AA101',
    prioridad: 10,
    condiciones_json: JSON.stringify({
      monto_max: 10000,
      criticidad_max: 'media',
      historial_solicitante_min: 5,
      materiales_conocidos_only: false,
    }),
    created_at: '2026-02-10',
  },
  {
    id: 2,
    nombre: 'Regla materiales conocidos',
    descripcion: '',
    activo: 0,
    centro_id: '',
    prioridad: 50,
    condiciones_json: JSON.stringify({
      monto_max: 50000,
      criticidad_max: 'alta',
      historial_solicitante_min: 10,
      materiales_conocidos_only: true,
    }),
    created_at: '2026-02-12',
  },
]

// ============================================================================
// HELPERS
// ============================================================================

import AdminAutoAprobacion from '../AdminAutoAprobacion'

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAutoAprobacion />
    </MemoryRouter>
  )
}

// ============================================================================
// TESTS
// ============================================================================

describe('AdminAutoAprobacion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ data: { ok: true, rules: mockRules } })
  })

  // --------------------------------------------------------------------------
  // 1. Renders title and "Nueva Regla" button
  // --------------------------------------------------------------------------
  it('renders the page title and Nueva Regla button', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Reglas de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })
    expect(screen.getByText('Nueva Regla')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 2. Renders info Alert about auto-approval rules
  // --------------------------------------------------------------------------
  it('renders the info Alert explaining auto-approval rules', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText(/Las reglas de auto-aprobaci\u00f3n permiten aprobar autom\u00e1ticamente/)).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 3. Renders loading state
  // --------------------------------------------------------------------------
  it('renders loading state while fetching rules', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(screen.getByTestId('grid-loading')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 4. Renders empty state when no rules
  // --------------------------------------------------------------------------
  it('renders empty state when there are no rules', async () => {
    mockApiGet.mockResolvedValue({ data: { ok: true, rules: [] } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-empty')).toBeInTheDocument()
    })
    expect(screen.getByText('No hay reglas configuradas')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 5. Renders rules list with data
  // --------------------------------------------------------------------------
  it('renders rules list after fetching data', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('grid-row-2')).toBeInTheDocument()
    expect(screen.getByText('Regla bajo monto')).toBeInTheDocument()
    expect(screen.getByText('Regla materiales conocidos')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 6. Opens create dialog on "Nueva Regla" click
  // --------------------------------------------------------------------------
  it('opens create dialog when clicking Nueva Regla', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // 7. Dialog has all form fields
  // --------------------------------------------------------------------------
  it('dialog contains all expected form fields', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })

    // Text fields
    expect(screen.getByLabelText(/Nombre de la regla/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Descripci\u00f3n/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Centro/)).toBeInTheDocument()

    // Priority slider
    expect(screen.getByText(/Prioridad.*100/)).toBeInTheDocument()

    // Conditions section
    expect(screen.getByText('Condiciones')).toBeInTheDocument()
    expect(screen.getByText(/Monto m\u00e1ximo/)).toBeInTheDocument()
    expect(screen.getByText(/Historial m\u00ednimo del solicitante/)).toBeInTheDocument()
    expect(screen.getByText(/Criticidad m\u00e1xima/)).toBeInTheDocument()

    // Criticidad chips
    expect(screen.getByText('Baja')).toBeInTheDocument()
    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Cr\u00edtica')).toBeInTheDocument()

    // Switch for materiales conocidos
    expect(screen.getByText('Solo materiales previamente solicitados')).toBeInTheDocument()

    // Active switch
    expect(screen.getByText('Regla activa')).toBeInTheDocument()

    // Simulate button
    expect(screen.getByText(/Simular \(.*30 d\u00edas\)/)).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 8. Can close dialog with Cancel button
  // --------------------------------------------------------------------------
  it('closes dialog when clicking Cancel', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cancelar'))

    await waitFor(() => {
      expect(screen.queryByText('Nueva Regla de Auto-Aprobaci\u00f3n')).not.toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // 9. Validates required name field
  // --------------------------------------------------------------------------
  it('shows warning toast when trying to save with empty name', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })

    // The Crear button should be disabled when name is empty
    const crearBtn = screen.getByRole('button', { name: 'Crear' })
    expect(crearBtn).toBeDisabled()
  })

  // --------------------------------------------------------------------------
  // 10. Creates new rule (api.post)
  // --------------------------------------------------------------------------
  it('creates a new rule via api.post', async () => {
    mockApiPost.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })

    // Fill in the name
    const nameInput = screen.getByLabelText(/Nombre de la regla/)
    fireEvent.change(nameInput, { target: { value: 'Test Rule' } })

    // Click create
    const crearBtn = screen.getByRole('button', { name: 'Crear' })
    fireEvent.click(crearBtn)

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/admin/auto-approval-rules',
        expect.objectContaining({
          nombre: 'Test Rule',
          condiciones_json: expect.any(String),
        })
      )
    })

    expect(mockToast.success).toHaveBeenCalledWith('Regla creada')
  })

  // --------------------------------------------------------------------------
  // 11. Opens edit dialog with existing data
  // --------------------------------------------------------------------------
  it('opens edit dialog with existing rule data', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })

    // Click the edit button for the first rule
    const row = screen.getByTestId('grid-row-1')
    const editBtn = within(row).getByLabelText('Editar')
    fireEvent.click(editBtn)

    await waitFor(() => {
      expect(screen.getByText('Editar Regla')).toBeInTheDocument()
    })

    // Check that the name field is pre-populated
    const nameInput = screen.getByLabelText(/Nombre de la regla/)
    expect(nameInput.value).toBe('Regla bajo monto')
  })

  // --------------------------------------------------------------------------
  // 12. Updates existing rule (api.put)
  // --------------------------------------------------------------------------
  it('updates an existing rule via api.put', async () => {
    mockApiPut.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })

    const row = screen.getByTestId('grid-row-1')
    const editBtn = within(row).getByLabelText('Editar')
    fireEvent.click(editBtn)

    await waitFor(() => {
      expect(screen.getByText('Editar Regla')).toBeInTheDocument()
    })

    // Change the name
    const nameInput = screen.getByLabelText(/Nombre de la regla/)
    fireEvent.change(nameInput, { target: { value: 'Regla editada' } })

    // Click Guardar
    const guardarBtn = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(guardarBtn)

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith(
        '/admin/auto-approval-rules/1',
        expect.objectContaining({
          nombre: 'Regla editada',
        })
      )
    })

    expect(mockToast.success).toHaveBeenCalledWith('Regla actualizada')
  })

  // --------------------------------------------------------------------------
  // 13. Delete opens confirmation dialog
  // --------------------------------------------------------------------------
  it('opens confirmation dialog when clicking delete', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })

    const row = screen.getByTestId('grid-row-1')
    const deleteBtn = within(row).getByLabelText('Eliminar')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('\u00bfEliminar esta regla de auto-aprobaci\u00f3n?')).toBeInTheDocument()
    })
    expect(screen.getByText('Esta acci\u00f3n no se puede deshacer.')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 14. Confirm delete calls api.delete
  // --------------------------------------------------------------------------
  it('calls api.delete when confirming deletion', async () => {
    mockApiDelete.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })

    const row = screen.getByTestId('grid-row-1')
    const deleteBtn = within(row).getByLabelText('Eliminar')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('\u00bfEliminar esta regla de auto-aprobaci\u00f3n?')).toBeInTheDocument()
    })

    // Click the confirmation "Eliminar" button inside the confirmation dialog
    const confirmDialog = screen.getByText('\u00bfEliminar esta regla de auto-aprobaci\u00f3n?').closest('[role="dialog"]')
    const confirmBtn = within(confirmDialog).getByRole('button', { name: 'Eliminar' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/admin/auto-approval-rules/1')
    })
    expect(mockToast.success).toHaveBeenCalledWith('Regla eliminada')
  })

  // --------------------------------------------------------------------------
  // 15. Cancel delete closes confirmation dialog
  // --------------------------------------------------------------------------
  it('closes confirmation dialog when clicking Cancel', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })

    const row = screen.getByTestId('grid-row-1')
    const deleteBtn = within(row).getByLabelText('Eliminar')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('\u00bfEliminar esta regla de auto-aprobaci\u00f3n?')).toBeInTheDocument()
    })

    const confirmDialog = screen.getByText('\u00bfEliminar esta regla de auto-aprobaci\u00f3n?').closest('[role="dialog"]')
    const cancelBtn = within(confirmDialog).getByRole('button', { name: 'Cancelar' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText('\u00bfEliminar esta regla de auto-aprobaci\u00f3n?')).not.toBeInTheDocument()
    })
    expect(mockApiDelete).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // 16. Simulate button calls api.post with conditions
  // --------------------------------------------------------------------------
  it('calls simulate endpoint when clicking Simular button', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        ok: true,
        auto_aprobables: 5,
        total_solicitudes: 20,
        porcentaje: 25,
      },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    // Open dialog first
    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })

    // Click simulate
    const simBtn = screen.getByText(/Simular \(.*30 d\u00edas\)/)
    fireEvent.click(simBtn)

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/admin/auto-approval-rules/simulate',
        expect.objectContaining({
          condiciones: expect.objectContaining({
            monto_max: 50000,
            criticidad_max: 'media',
          }),
          dias: 30,
        })
      )
    })
  })

  // --------------------------------------------------------------------------
  // 17. Simulation result is displayed
  // --------------------------------------------------------------------------
  it('displays simulation result after successful simulate', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        ok: true,
        auto_aprobables: 5,
        total_solicitudes: 20,
        porcentaje: 25,
      },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Simular \(.*30 d\u00edas\)/))

    await waitFor(() => {
      expect(screen.getByText('Resultado de simulaci\u00f3n:')).toBeInTheDocument()
    })

    // The simulation details should appear
    expect(screen.getByText(/5 de 20 solicitudes/)).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 18. Error toast on fetch failure
  // --------------------------------------------------------------------------
  it('shows error toast when fetch fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))
    renderPage()

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar reglas')
    })
  })

  // --------------------------------------------------------------------------
  // 19. Success toast on create
  // --------------------------------------------------------------------------
  it('shows success toast when a rule is created', async () => {
    mockApiPost.mockResolvedValue({ data: { ok: true } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nueva Regla'))

    await waitFor(() => {
      expect(screen.getByText('Nueva Regla de Auto-Aprobaci\u00f3n')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Nombre de la regla/), {
      target: { value: 'New rule name' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Regla creada')
    })
  })

  // --------------------------------------------------------------------------
  // 20. Column headers render correctly
  // --------------------------------------------------------------------------
  it('renders all expected column headers in the grid', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })

    const grid = screen.getByTestId('spm-ag-grid')
    expect(within(grid).getByText('Nombre')).toBeInTheDocument()
    expect(within(grid).getByText('Prioridad')).toBeInTheDocument()
    expect(within(grid).getByText('Centro')).toBeInTheDocument()
    expect(within(grid).getByText('Monto M\u00e1x.')).toBeInTheDocument()
    expect(within(grid).getByText('Estado')).toBeInTheDocument()
    expect(within(grid).getByText('Creada')).toBeInTheDocument()
    expect(within(grid).getByText('Acciones')).toBeInTheDocument()
  })
})
