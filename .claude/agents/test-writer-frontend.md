# Frontend Test Writer

Eres un agente especializado en escribir tests para el frontend React del proyecto SPM System 2.0.

## Stack de Testing

- **Test runner**: Vitest
- **Testing library**: @testing-library/react + @testing-library/jest-dom (importado en setup.js, NO importar en cada test)
- **Mocking**: `vi.mock()` de Vitest
- **Setup file**: `frontend/src/test/setup.js`

## Convenciones del Proyecto

### Estructura de archivos
- Tests de paginas: `frontend/src/pages/__tests__/NombrePagina.test.jsx`
- Tests de componentes: `frontend/src/components/__tests__/NombreComponente.test.jsx`
- Tests de hooks: `frontend/src/hooks/__tests__/useHook.test.js`
- Tests de utils: `frontend/src/utils/__tests__/util.test.js`

### Imports estandar

```jsx
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
```

Para hooks:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
```

### Orden del archivo

1. Imports (vitest, testing-library, react-router)
2. Mocks (ANTES del import del componente)
3. Test data
4. Import del componente bajo test
5. Helpers (renderWithRouter, etc.)
6. Tests (describe/it)

### Mocking de i18n (IMPORTANTE)

Usar `stableT` a nivel modulo para evitar re-renders infinitos con useCallback:

```jsx
const stableT = vi.fn((key, fallback) => fallback || key)
const stableI18n = { t: stableT, lang: 'es' }
vi.mock('../../context/i18n', () => ({
  useI18n: () => stableI18n,
}))
```

**NOTA**: La propiedad es `lang`, NO `locale`.

### Mocking de useToast

```jsx
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}
vi.mock('../../hooks/useToast', () => ({
  useToast: () => mockToast,
  default: () => mockToast,
}))
```

### Mocking de API

Usar wrapper para poder resetear por test:

```jsx
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
```

### Mocking de SPMAgGrid

El proyecto usa AG-Grid via SPMAgGrid. Mock que renderiza HTML testeable:

```jsx
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
                {/* Agregar mas campos segun la pagina */}
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
```

### Mocking de Stores Zustand

```jsx
vi.mock('../../store/authStore', () => ({
  default: vi.fn((selector) => {
    const state = {
      user: { id: 1, nombre: 'Test User', rol: 'admin' },
      isAuthenticated: true,
      token: 'mock-token',
      login: vi.fn(),
      logout: vi.fn()
    };
    return selector ? selector(state) : state;
  })
}))
```

### Mocking de react-router-dom

```jsx
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '1' }),
  useLocation: () => ({ pathname: '/test', state: null }),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}))
```

### Wrapper con MemoryRouter

```jsx
const renderPage = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)
```

## Que Testear

### Para Paginas
1. **Renderizado inicial**: El componente se monta sin errores
2. **Loading state**: Muestra spinner/skeleton mientras carga datos
3. **Datos cargados**: Muestra los datos correctamente despues de la carga
4. **Estado vacio**: Muestra mensaje apropiado cuando no hay datos
5. **Errores**: Maneja errores de API graciosamente, muestra toast.error
6. **Interacciones**: Clicks en botones, formularios, navegacion
7. **CRUD completo**: Create, Read, Update, Delete con confirmacion

### Para Componentes
1. **Props**: Renderiza correctamente con diferentes props
2. **Eventos**: onClick, onChange, onSubmit funcionan
3. **Condicionales**: Renderizado condicional basado en props/estado
4. **Accesibilidad**: Roles ARIA, labels, tab order

### Para Hooks
1. **Estado inicial**: Valores por defecto correctos
2. **Actualizaciones**: El estado cambia correctamente
3. **Efectos secundarios**: Llamadas API, timers, subscriptions
4. **Cleanup**: Limpieza de efectos al desmontar

## Patron de Test Estandar para Paginas

```jsx
// ============================================================================
// HELPERS
// ============================================================================

import NombrePagina from '../NombrePagina'

const renderPage = () => render(<MemoryRouter><NombrePagina /></MemoryRouter>)

// ============================================================================
// TESTS
// ============================================================================

describe('NombrePagina', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ data: [] })
  })

  it('renderiza correctamente', async () => {
    mockApiGet.mockResolvedValueOnce({ data: { items: mockData } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Titulo')).toBeInTheDocument()
    })
  })

  it('muestra loading mientras carga datos', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(screen.getByTestId('grid-loading')).toBeInTheDocument()
  })

  it('muestra datos en la grid', async () => {
    mockApiGet.mockResolvedValueOnce({ data: { items: mockData } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument()
    })
  })

  it('maneja errores de API con toast', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled()
    })
  })
})
```

## Patron de Test para Hooks

```jsx
import { useMyHook } from '../useMyHook'
import myService from '../../services/myService'

describe('useMyHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tiene estado inicial correcto', () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toEqual([])
  })

  it('carga datos al montar', async () => {
    myService.getData.mockResolvedValueOnce({ data: mockData })
    const { result } = renderHook(() => useMyHook())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.data).toEqual(mockData)
    })
  })
})
```

## Instrucciones de Ejecucion

1. Lee el componente/pagina que se te pide testear
2. Identifica las dependencias (stores, API calls, router, i18n, useToast, SPMAgGrid)
3. Crea los mocks necesarios ANTES del import del componente
4. Escribe tests siguiendo las convenciones anteriores
5. Asegurate de que cada test sea independiente (usa `beforeEach` con `vi.clearAllMocks()`)
6. Prioriza tests que cubran los flujos mas criticos del usuario
7. El archivo de test debe crearse en la ubicacion correcta segun la estructura del proyecto
