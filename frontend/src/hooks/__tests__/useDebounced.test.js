/**
 * Tests para useDebounced hook
 * Verifica el debounce de valores en React
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDebouncedValue as useDebounced } from '../useDebouncedValue'

describe('useDebounced', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debe retornar el valor inicial inmediatamente', () => {
    const { result } = renderHook(() => useDebounced('initial', 300))
    expect(result.current).toBe('initial')
  })

  it('debe retornar el valor debounced después del delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    )

    expect(result.current).toBe('initial')

    // Cambiar valor
    rerender({ value: 'updated', delay: 300 })

    // Antes del timeout, sigue siendo el valor anterior
    expect(result.current).toBe('initial')

    // Avanzar el timer
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Después del timeout, se actualiza
    expect(result.current).toBe('updated')
  })

  it('debe cancelar el timer anterior cuando el valor cambia', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    )

    // Primer cambio
    rerender({ value: 'first', delay: 300 })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    // Segundo cambio antes de que expire el timer
    rerender({ value: 'second', delay: 300 })

    // Avanzar solo 200ms más (total 350ms)
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // No debería haber cambiado aún (el nuevo timer tiene 300ms)
    expect(result.current).toBe('initial')

    // Completar el timer
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe('second')
  })

  it('debe funcionar con diferentes delays', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Aún no debería cambiar
    expect(result.current).toBe('initial')

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Ahora sí
    expect(result.current).toBe('updated')
  })

  it('debe manejar valores de diferentes tipos', () => {
    // Número
    const { result: numResult, rerender: numRerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    )

    expect(numResult.current).toBe(0)

    numRerender({ value: 42, delay: 100 })
    act(() => vi.advanceTimersByTime(100))
    expect(numResult.current).toBe(42)

    // Objeto
    const { result: objResult, rerender: objRerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: { foo: 'bar' }, delay: 100 } }
    )

    expect(objResult.current).toEqual({ foo: 'bar' })

    objRerender({ value: { foo: 'baz' }, delay: 100 })
    act(() => vi.advanceTimersByTime(100))
    expect(objResult.current).toEqual({ foo: 'baz' })
  })

  it('debe manejar delay de 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    )

    rerender({ value: 'updated', delay: 0 })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toBe('updated')
  })

  it('debe limpiar el timer al desmontar', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    )

    rerender({ value: 'updated', delay: 300 })
    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('debe manejar valores null y undefined', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: null, delay: 100 } }
    )

    expect(result.current).toBe(null)

    rerender({ value: undefined, delay: 100 })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(undefined)
  })

  it('debe mantener el valor cuando no hay cambios', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounced(value, delay),
      { initialProps: { value: 'same', delay: 100 } }
    )

    // Re-render con el mismo valor
    rerender({ value: 'same', delay: 100 })

    act(() => vi.advanceTimersByTime(100))

    expect(result.current).toBe('same')
  })
})
