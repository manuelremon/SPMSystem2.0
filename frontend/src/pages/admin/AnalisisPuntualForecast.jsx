/**
 * AnalisisPuntualForecast - Forecast con datos temporales
 *
 * Permite generar pronosticos de demanda utilizando los datos
 * de consumo historico importados desde Excel.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import { TempDataBanner } from '../../components/ui/TempDataBanner'
import { useI18n } from '../../context/i18n'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import api from '../../services/api'
import clsx from 'clsx'
import {
  LineChart,
  TrendingUp,
  RefreshCw,
  Loader2,
  ChevronLeft,
  Search,
  BarChart2,
} from '../../components/ui/Icons'

export default function AnalisisPuntualForecast() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tempActive, setTempActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Estado del forecast
  const [materialCodigo, setMaterialCodigo] = useState('')
  const [modelo, setModelo] = useState('auto')
  const [diasPrediccion, setDiasPrediccion] = useState(30)
  const [forecastData, setForecastData] = useState(null)
  const [materialesDisponibles, setMaterialesDisponibles] = useState([])
  const [loadingMateriales, setLoadingMateriales] = useState(true)

  // Si no hay datos temporales, redirigir a home
  useEffect(() => {
    if (!tempActive) {
      navigate('/admin/analisis-puntual')
    }
  }, [tempActive, navigate])

  // Cargar lista de materiales disponibles en datos temporales
  useEffect(() => {
    const fetchMateriales = async () => {
      try {
        const response = await api.get('/api/admin/temp-data/materiales')
        if (response.data.ok) {
          setMaterialesDisponibles(response.data.materiales || [])
        }
      } catch (err) {
        console.error('Error cargando materiales:', err)
      } finally {
        setLoadingMateriales(false)
      }
    }

    if (tempActive) {
      fetchMateriales()
    }
  }, [tempActive])

  // Ejecutar forecast
  const ejecutarForecast = useCallback(async () => {
    if (!materialCodigo) {
      setError('Selecciona un material')
      return
    }

    setLoading(true)
    setError(null)
    setForecastData(null)

    try {
      const response = await api.post('/api/ai/forecast/individual', {
        material: materialCodigo,
        modelo: modelo,
        dias: diasPrediccion,
        use_temp_data: true
      })

      if (response.data.ok) {
        setForecastData(response.data)
      } else {
        setError(response.data.error || 'Error al generar forecast')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar forecast')
    } finally {
      setLoading(false)
    }
  }, [materialCodigo, modelo, diasPrediccion])

  const modelosDisponibles = [
    { value: 'auto', label: 'Automatico (mejor modelo)' },
    { value: 'prophet', label: 'Prophet (Facebook)' },
    { value: 'arima', label: 'ARIMA' },
    { value: 'xgboost', label: 'XGBoost' },
    { value: 'linear', label: 'Regresion Lineal' },
  ]

  return (
    <Layout>
      <div className="space-y-4">
        {/* Banner siempre visible */}
        <TempDataBanner onStatusChange={setTempActive} />

        {/* Breadcrumb */}
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
            {t('admin_ap_forecast', 'Forecast Temporal')}
          </span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Forecast - Pronosticos con Datos Temporales
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Genera pronosticos de demanda utilizando el consumo historico del Excel importado
          </p>
        </div>

        {/* Formulario de busqueda */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Configuracion del Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              {/* Material */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Material
                </label>
                {loadingMateriales ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando materiales...
                  </div>
                ) : (
                  <Select
                    value={materialCodigo}
                    onChange={(e) => setMaterialCodigo(e.target.value)}
                    disabled={materialesDisponibles.length === 0}
                  >
                    <option value="">Seleccionar material</option>
                    {materialesDisponibles.map((mat) => (
                      <option key={mat.material} value={mat.material}>
                        {mat.material} - {mat.descripcion?.substring(0, 30)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {/* Modelo */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Modelo
                </label>
                <Select
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                >
                  {modelosDisponibles.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Dias de prediccion */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Dias a predecir
                </label>
                <Select
                  value={diasPrediccion}
                  onChange={(e) => setDiasPrediccion(Number(e.target.value))}
                >
                  <option value={7}>7 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={90}>90 dias</option>
                </Select>
              </div>

              {/* Boton */}
              <div className="flex items-end">
                <Button
                  variant="primary"
                  onClick={ejecutarForecast}
                  disabled={loading || !materialCodigo}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Generar Forecast
                    </>
                  )}
                </Button>
              </div>
            </div>

            {materialesDisponibles.length === 0 && !loadingMateriales && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                No hay materiales disponibles en los datos temporales. Verifica que el Excel importado tenga la hoja &quot;consumo_historico&quot;.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Resultados */}
        {forecastData && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5" />
                  Metricas del Modelo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-[var(--accent)]">
                      {forecastData.metricas?.mape?.toFixed(1) || 'N/A'}%
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">MAPE</p>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-[var(--accent)]">
                      {forecastData.metricas?.rmse?.toFixed(2) || 'N/A'}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">RMSE</p>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {forecastData.modelo_usado || modelo}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">Modelo</p>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {forecastData.registros_historico || 0}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">Registros Historico</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Predicciones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Predicciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                {forecastData.predicciones?.length > 0 ? (
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--card)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Fecha</th>
                          <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Prediccion</th>
                          <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Min</th>
                          <th className="text-right py-2 px-3 font-medium text-[var(--text-muted)]">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastData.predicciones.map((pred, idx) => (
                          <tr key={idx} className="border-b border-[var(--border)]">
                            <td className="py-2 px-3 text-[var(--text-secondary)]">{pred.fecha}</td>
                            <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)]">
                              {pred.prediccion?.toFixed(2) || 0}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--text-muted)]">
                              {pred.intervalo_min?.toFixed(2) || '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--text-muted)]">
                              {pred.intervalo_max?.toFixed(2) || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    No hay predicciones disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mensaje de ayuda cuando no hay resultados */}
        {!forecastData && !loading && !error && (
          <div className="bg-[var(--card)] rounded-xl p-8 border border-[var(--border)] text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <LineChart className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Selecciona un material para comenzar
            </h3>
            <p className="text-[var(--text-muted)]">
              Elige un material de la lista y configura los parametros del modelo para generar un pronostico de demanda.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
