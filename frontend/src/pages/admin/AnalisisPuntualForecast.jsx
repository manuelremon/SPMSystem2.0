/**
 * AnalisisPuntualForecast - Forecast con datos temporales
 *
 * Permite generar pronosticos de demanda utilizando los datos
 * de consumo historico importados desde Excel.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { TempDataBanner } from '../../components/ui/TempDataBanner'
import { useI18n } from '../../context/i18n'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { SPMAgGrid } from '../../components/ui/SPMAgGrid'
import PageLayout from '../../components/ui/PageLayout'
import { formatNumber, formatDate } from '../../utils/formatters'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import SearchIcon from '@mui/icons-material/Search'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import BarChartIcon from '@mui/icons-material/BarChart'

/**
 * Componente tabla de predicciones migrado a SPMAgGrid
 */
function PredictionTable({ data }) {
  const { t } = useI18n()

  const rows = useMemo(() => {
    return data.map((pred, idx) => ({
      ...pred,
      id: idx,
    }))
  }, [data])

  const columnDefs = useMemo(() => [
    {
      field: 'fecha',
      headerName: t('common_date', 'Fecha'),
      flex: 0.4,
      minWidth: 100,
      valueFormatter: (params) => (params.value ? formatDate(params.value) : '—'),
    },
    {
      field: 'prediccion',
      headerName: t('forecast_prediction', 'Predicción'),
      flex: 0.3,
      minWidth: 100,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => formatNumber(params.value ?? 0, 2),
    },
    {
      field: 'intervalo_min',
      headerName: t('forecast_min', 'Mín.'),
      flex: 0.25,
      minWidth: 80,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => (params.value == null ? '—' : formatNumber(params.value, 2)),
    },
    {
      field: 'intervalo_max',
      headerName: t('forecast_max', 'Máx.'),
      flex: 0.25,
      minWidth: 80,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => (params.value == null ? '—' : formatNumber(params.value, 2)),
    },
  ], [t])

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={300}
      pagination={true}
      paginationPageSize={25}
      enableQuickFilter={true}
      exportFileName="predicciones_forecast"
      emptyMessage={t('common_no_data', 'Sin datos')}
    />
  )
}

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
        const response = await api.get('/admin/temp-data/materiales')
        if (response.data.ok) {
          setMaterialesDisponibles(response.data.materiales || [])
        }
      } catch {
        // Sin materiales: se muestra el aviso de la hoja "consumo_historico"
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
      setError(t('ap_fc_selecciona_material', 'Selecciona un material'))
      return
    }

    setLoading(true)
    setError(null)
    setForecastData(null)

    try {
      const response = await api.post('/ai/forecast/individual', {
        material: materialCodigo,
        modelo: modelo,
        dias: diasPrediccion,
        use_temp_data: true
      })

      if (response.data.ok) {
        setForecastData(response.data)
      } else {
        const errData = response.data.error
        setError(typeof errData === 'object' ? (errData?.message || 'Error al generar el forecast') : (errData || 'Error al generar el forecast'))
      }
    } catch (err) {
      const errData = err.response?.data?.error
      setError(typeof errData === 'object' ? (errData?.message || 'Error al generar el forecast') : (errData || 'Error al generar el forecast'))
    } finally {
      setLoading(false)
    }
  }, [materialCodigo, modelo, diasPrediccion, t])

  const modelosDisponibles = [
    { value: 'auto', label: t('ap_fc_modelo_auto', 'Automático (mejor modelo)') },
    { value: 'prophet', label: 'Prophet (Facebook)' },
    { value: 'arima', label: 'ARIMA' },
    { value: 'xgboost', label: 'XGBoost' },
    { value: 'linear', label: t('ap_fc_modelo_linear', 'Regresión lineal') },
  ]

  const diasOptions = [
    { value: 7, label: `7 ${t('common_dias', 'días')}` },
    { value: 15, label: `15 ${t('common_dias', 'días')}` },
    { value: 30, label: `30 ${t('common_dias', 'días')}` },
    { value: 60, label: `60 ${t('common_dias', 'días')}` },
    { value: 90, label: `90 ${t('common_dias', 'días')}` },
  ]

  return (
    <PageLayout
      title={t('ap_fc_titulo', 'Forecast: pronósticos con datos temporales')}
      subtitle={t('ap_fc_subtitulo', 'Análisis puntual · Forecast temporal')}
      backTo="/admin/analisis-puntual"
    >
        {/* Banner siempre visible */}
        <TempDataBanner onStatusChange={setTempActive} />

        {/* Formulario de busqueda */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                {t('ap_fc_config', 'Configuración del forecast')}
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="flex-end">
              {/* Material */}
              <Grid size={{ xs: 12, md: 3 }}>
                {loadingMateriales ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      {t('ap_fc_cargando_materiales', 'Cargando materiales...')}
                    </Typography>
                  </Stack>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel id="material-label">{t('common_material', 'Material')}</InputLabel>
                    <Select
                      labelId="material-label"
                      value={materialCodigo}
                      label={t('common_material', 'Material')}
                      onChange={(e) => setMaterialCodigo(e.target.value)}
                      disabled={materialesDisponibles.length === 0}
                    >
                      <MenuItem value="">
                        <em>{t('ap_fc_seleccionar_material', 'Selecciona un material')}</em>
                      </MenuItem>
                      {materialesDisponibles.map((mat) => (
                        <MenuItem key={mat.material} value={mat.material}>
                          {mat.material} - {mat.descripcion?.substring(0, 30)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Grid>

              {/* Modelo */}
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="modelo-label">{t('ap_fc_modelo', 'Modelo')}</InputLabel>
                  <Select
                    labelId="modelo-label"
                    value={modelo}
                    label={t('ap_fc_modelo', 'Modelo')}
                    onChange={(e) => setModelo(e.target.value)}
                  >
                    {modelosDisponibles.map((m) => (
                      <MenuItem key={m.value} value={m.value}>
                        {m.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Dias de prediccion */}
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="dias-label">{t('ap_fc_dias', 'Días a predecir')}</InputLabel>
                  <Select
                    labelId="dias-label"
                    value={diasPrediccion}
                    label={t('ap_fc_dias', 'Días a predecir')}
                    onChange={(e) => setDiasPrediccion(Number(e.target.value))}
                  >
                    {diasOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Boton */}
              <Grid size={{ xs: 12, md: 3 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={ejecutarForecast}
                  disabled={loading || !materialCodigo}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <TrendingUpIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  {loading ? t('ap_fc_generando', 'Generando...') : t('ap_fc_generar', 'Generar forecast')}
                </Button>
              </Grid>
            </Grid>

            {materialesDisponibles.length === 0 && !loadingMateriales && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {t('ap_fc_sin_materiales', 'No hay materiales disponibles en los datos temporales. Verifica que el Excel importado tenga la hoja "consumo_historico".')}
              </Alert>
            )}
          </Box>
        </Paper>

        {/* Error */}
        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Resultados */}
        {forecastData && (
          <Grid container spacing={2}>
            {/* KPIs */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BarChartIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {t('ap_fc_metricas', 'Métricas del modelo')}
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="primary.main">
                          {forecastData.metricas?.mape != null ? `${formatNumber(forecastData.metricas.mape, 1)}%` : '—'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          MAPE
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="primary.main">
                          {forecastData.metricas?.rmse != null ? formatNumber(forecastData.metricas.rmse, 2) : '—'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          RMSE
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="text.primary">
                          {forecastData.modelo_usado || modelo}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('ap_fc_modelo', 'Modelo')}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="text.primary">
                          {formatNumber(forecastData.registros_historico || 0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('ap_fc_registros', 'Registros históricos')}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Grid>

            {/* Predicciones */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ShowChartIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {t('forecast_predictions', 'Predicciones')}
                    </Typography>
                  </Stack>
                </Box>
                {forecastData.predicciones?.length > 0 && (
                  <Box sx={{ flex: 1, minHeight: 300 }}>
                    <PredictionTable data={forecastData.predicciones} />
                  </Box>
                )}
                {!forecastData.predicciones?.length && (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('ap_fc_sin_predicciones', 'No hay predicciones disponibles')}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Mensaje de ayuda cuando no hay resultados */}
        {!forecastData && !loading && !error && (
          <Paper
            elevation={0}
            sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'primary.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}
            >
              <ShowChartIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
              {t('ap_fc_empty_title', 'Selecciona un material para comenzar')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('ap_fc_empty_desc', 'Elige un material de la lista y configura los parámetros del modelo para generar un pronóstico de demanda.')}
            </Typography>
          </Paper>
        )}
    </PageLayout>
  );
}
