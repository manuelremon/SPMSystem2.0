/**
 * TempDataBanner - Banner que indica cuando el modo temporal está activo
 *
 * Muestra información sobre los datos temporales importados y
 * permite desactivar el modo temporal.
 */

import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Button } from './Button'
import { getTempDataStatus, clearTempData } from '../../services/tempData'

export function TempDataBanner({ onStatusChange, variant = 'full' }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  // Cargar estado al montar
  const loadStatus = useCallback(async () => {
    try {
      const result = await getTempDataStatus()
      if (result.ok) {
        setStatus(result.active ? result.data : null)
        if (onStatusChange) {
          onStatusChange(result.active)
        }
      }
    } catch (err) {
      // Si hay error, probablemente no hay permisos de admin
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [onStatusChange])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Desactivar modo temporal
  const handleClear = async () => {
    if (!confirm('¿Desactivar modo temporal? Volverá a usar datos de la base de datos.')) {
      return
    }

    setClearing(true)
    try {
      await clearTempData()
      setStatus(null)
      if (onStatusChange) {
        onStatusChange(false)
      }
    } catch (err) {
      console.error('Error clearing temp data:', err)
    } finally {
      setClearing(false)
    }
  }

  // No mostrar si está cargando o no hay modo temporal activo
  if (loading || !status) {
    return null
  }

  // Variante compacta (para sidebar o header)
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
        <span className="text-xs font-medium text-amber-500">Modo Temporal</span>
      </div>
    )
  }

  // Variante minimal (solo indicador)
  if (variant === 'minimal') {
    return (
      <div
        className="flex items-center gap-1 text-amber-500"
        title={`Datos temporales: ${status?.archivo || 'Excel importado'}`}
      >
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
        <span className="text-xs">Temp</span>
      </div>
    )
  }

  // Variante completa (banner destacado)
  return (
    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {/* Icono animado */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-amber-500">Modo Temporal Activo</h4>
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-500 rounded-full">
                Excel
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {status?.archivo && (
                <span className="font-medium">{status.archivo}</span>
              )}
              {status?.stats && (
                <span className="ml-2 text-[var(--text-muted)]">
                  {status.stats.materiales} materiales, {status.stats.registros_consumo} consumos
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClear}
            disabled={clearing}
            className="!bg-amber-500/20 !text-amber-500 hover:!bg-amber-500/30"
          >
            {clearing ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Desactivando...
              </>
            ) : (
              'Desactivar Modo Temporal'
            )}
          </Button>
        </div>
      </div>

      {/* Info adicional */}
      {status?.stats?.rango_fechas && status.stats.rango_fechas[0] && (
        <div className="mt-3 pt-3 border-t border-amber-500/20 text-sm text-[var(--text-muted)]">
          Datos desde <strong>{status.stats.rango_fechas[0]}</strong> hasta{' '}
          <strong>{status.stats.rango_fechas[1]}</strong>
        </div>
      )}

      {/* Advertencias */}
      {status?.advertencias?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-500/20">
          <details className="text-sm">
            <summary className="cursor-pointer text-amber-500 hover:text-amber-400">
              {status.advertencias.length} advertencia(s)
            </summary>
            <ul className="mt-2 space-y-1 text-[var(--text-muted)] list-disc list-inside">
              {status.advertencias.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}

TempDataBanner.propTypes = {
  onStatusChange: PropTypes.func,
  variant: PropTypes.oneOf(['full', 'compact', 'minimal'])
}

TempDataBanner.defaultProps = {
  variant: 'full'
}

export default TempDataBanner
