/**
 * AnalisisPuntualMRP - MRP con datos temporales
 *
 * Muestra el tablero de alertas MRP utilizando datos importados desde Excel.
 * Reutiliza la logica de MRPTableroAlertas pero fuerza el uso de datos temporales.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import { TempDataBanner } from '../../components/ui/TempDataBanner'
import { useI18n } from '../../context/i18n'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import api from '../../services/api'
import clsx from 'clsx'
import {
  AlertTriangle,
  Package,
  TrendingDown,
  RefreshCw,
  Loader2,
  ChevronLeft,
} from '../../components/ui/Icons'

export default function AnalisisPuntualMRP() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tempActive, setTempActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [resumen, setResumen] = useState({})

  // Si no hay datos temporales, redirigir a home
  useEffect(() => {
    if (!tempActive) {
      navigate('/admin/analisis-puntual')
    }
  }, [tempActive, navigate])

  // Cargar alertas MRP con datos temporales
  const fetchAlertas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/mrp/alertas', {
        params: { use_temp_data: true, limit: 100 }
      })
      if (response.data.ok) {
        setAlertas(response.data.alertas || [])
        setResumen(response.data.resumen || {})
      } else {
        const errData = response.data.error
        setError(typeof errData === 'object' ? (errData?.message || 'Error') : (errData || 'Error al cargar alertas'))
      }
    } catch (err) {
      const errorData = err.response?.data?.error
      // Handle error object or string
      const errorMsg = typeof errorData === 'object'
        ? (errorData?.message || JSON.stringify(errorData))
        : (errorData || 'Error al cargar alertas MRP')
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tempActive) {
      fetchAlertas()
    }
  }, [tempActive, fetchAlertas])

  const getEstadoColor = (estado) => {
    const estados = {
      'SIN_STOCK': 'danger',
      'STOCK_CRITICO': 'warning',
      'BAJO_PUNTO_PEDIDO': 'warning',
      'BAJO_MINIMO': 'warning',
      'STOCK_EXCEDIDO': 'info',
      'OK': 'success',
    }
    return estados[estado] || 'info'
  }

  const colorClasses = {
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  }

  return (
    <Layout>
      <div className="space-y-4">
        {/* Banner siempre visible */}
        <TempDataBanner onStatusChange={setTempActive} />

        {/* Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/analisis-puntual')}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('admin_ap_volver', 'Analisis Puntual')}
            </Button>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--text-primary)] font-medium">
              {t('admin_ap_mrp', 'MRP Temporal')}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAlertas}
            disabled={loading}
          >
            <RefreshCw className={clsx("w-4 h-4 mr-2", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            MRP - Alertas con Datos Temporales
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Analisis de stock y alertas utilizando los datos del Excel importado
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <>
            {/* Resumen Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Package className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {resumen.total_materiales || 0}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Total Materiales</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {resumen.sin_stock || 0}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Sin Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <TrendingDown className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">
                        {resumen.stock_critico || 0}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Stock Critico</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-500">
                        {resumen.bajo_punto_pedido || 0}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">Bajo Punto Pedido</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de Alertas */}
            <Card>
              <CardHeader>
                <CardTitle>Alertas de Stock ({alertas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {alertas.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    No hay alertas de stock con los datos importados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-3 px-4 font-medium text-[var(--text-muted)]">Material</th>
                          <th className="text-left py-3 px-4 font-medium text-[var(--text-muted)]">Descripcion</th>
                          <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Stock</th>
                          <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Minimo</th>
                          <th className="text-right py-3 px-4 font-medium text-[var(--text-muted)]">Pto Pedido</th>
                          <th className="text-center py-3 px-4 font-medium text-[var(--text-muted)]">Estado</th>
                          <th className="text-left py-3 px-4 font-medium text-[var(--text-muted)]">Centro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alertas.slice(0, 50).map((alerta, idx) => (
                          <tr
                            key={`${alerta.material}-${idx}`}
                            className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]"
                          >
                            <td className="py-3 px-4 font-mono text-[var(--text-primary)]">
                              {alerta.material}
                            </td>
                            <td className="py-3 px-4 text-[var(--text-secondary)] max-w-[200px] truncate">
                              {alerta.descripcion}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-[var(--text-primary)]">
                              {alerta.stock_actual?.toLocaleString() || 0}
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--text-muted)]">
                              {alerta.stock_minimo?.toLocaleString() || '-'}
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--text-muted)]">
                              {alerta.punto_pedido?.toLocaleString() || '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={clsx(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
                                colorClasses[getEstadoColor(alerta.estado)]
                              )}>
                                {alerta.estado?.replace(/_/g, ' ') || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[var(--text-muted)]">
                              {alerta.centro}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {alertas.length > 50 && (
                      <div className="text-center py-4 text-sm text-[var(--text-muted)]">
                        Mostrando 50 de {alertas.length} alertas
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  )
}
