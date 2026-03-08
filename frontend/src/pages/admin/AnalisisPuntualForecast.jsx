/**
 * AnalisisPuntualForecast - Forecast con datos temporales
 *
 * Permite generar pronosticos de demanda utilizando los datos
 * de consumo historico importados desde Excel.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '../../components/Layout'
import { TempDataBanner } from '../../components/ui/TempDataBanner'
import { useI18n } from '../../context/i18n'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { SPMAgGrid } from '../../components/ui/SPMAgGrid'
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
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
    },
    {
      field: 'prediccion',
      headerName: t('forecast_prediction', 'Predicción'),
      flex: 0.3,
      minWidth: 100,
      type: 'numericColumn',
      valueFormatter: (params) => params.value?.toFixed(2) || '0',
    },
    {
      field: 'intervalo_min',
      headerName: t('forecast_min', 'Mín'),
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.value?.toFixed(2) || '-',
    },
    {
      field: 'intervalo_max',
      headerName: t('forecast_max', 'Máx'),
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.value?.toFixed(2) || '-',
    },
  ], [t])

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={300}
      pagination={true}
      paginationPageSize={10}
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
      } catch (err) {
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
        setError(typeof errData === 'object' ? (errData?.message || 'Error') : (errData || 'Error al generar forecast'))
      }
    } catch (err) {
      const errData = err.response?.data?.error
      setError(typeof errData === 'object' ? (errData?.message || 'Error') : (errData || 'Error al generar forecast'))
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

  const diasOptions = [
    { value: 7, label: '7 dias' },
    { value: 15, label: '15 dias' },
    { value: 30, label: '30 dias' },
    { value: 60, label: '60 dias' },
    { value: 90, label: '90 dias' },
  ]

  return (
    <Layout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Banner siempre visible */}
        <TempDataBanner onStatusChange={setTempActive} />

        {/* Breadcrumb */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            variant="text"
            size="small"
            startIcon={<ChevronLeftIcon />}
            onClick={() => navigate('/admin/analisis-puntual')}
            sx={{ textTransform: 'none' }}
          >
            {t('admin_ap_volver', 'Analisis Puntual')}
          </Button>
          <Typography variant="body2" color="text.secondary">/</Typography>
          <Typography variant="body2" color="text.primary" fontWeight={500}>
            {t('admin_ap_forecast', 'Forecast Temporal')}
          </Typography>
        </Stack>

        {/* Header */}
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Forecast - Pronósticos con Datos Temporales
          </Typography>
        </Box>

        {/* Formulario de busqueda */}
        <Paper elevation={1}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="h6" fontWeight={600}>
                Configuracion del Forecast
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="flex-end">
              {/* Material */}
              <Grid item xs={12} md={3}>
                {loadingMateriales ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Cargando materiales...
                    </Typography>
                  </Stack>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel id="material-label">Material</InputLabel>
                    <Select
                      labelId="material-label"
                      value={materialCodigo}
                      label="Material"
                      onChange={(e) => setMaterialCodigo(e.target.value)}
                      disabled={materialesDisponibles.length === 0}
                    >
                      <MenuItem value="">
                        <em>Seleccionar material</em>
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
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="modelo-label">Modelo</InputLabel>
                  <Select
                    labelId="modelo-label"
                    value={modelo}
                    label="Modelo"
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
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="dias-label">Dias a predecir</InputLabel>
                  <Select
                    labelId="dias-label"
                    value={diasPrediccion}
                    label="Dias a predecir"
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
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={ejecutarForecast}
                  disabled={loading || !materialCodigo}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <TrendingUpIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  {loading ? 'Generando...' : 'Generar Forecast'}
                </Button>
              </Grid>
            </Grid>

            {materialesDisponibles.length === 0 && !loadingMateriales && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No hay materiales disponibles en los datos temporales. Verifica que el Excel importado tenga la hoja &quot;consumo_historico&quot;.
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
            <Grid item xs={12} md={6}>
              <Paper elevation={1}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BarChartIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Metricas del Modelo
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="primary.main">
                          {forecastData.metricas?.mape?.toFixed(1) || 'N/A'}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          MAPE
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="primary.main">
                          {forecastData.metricas?.rmse?.toFixed(2) || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          RMSE
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="text.primary">
                          {forecastData.modelo_usado || modelo}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Modelo
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper
                        elevation={0}
                        sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}
                      >
                        <Typography variant="h5" fontWeight="bold" color="text.primary">
                          {forecastData.registros_historico || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Registros Historico
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Grid>

            {/* Predicciones */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ShowChartIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="h6" fontWeight={600}>
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
                      {t('common_no_data', 'No hay predicciones disponibles')}
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
            elevation={1}
            sx={{ p: 4, textAlign: 'center' }}
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
            <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
              Selecciona un material para comenzar
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Elige un material de la lista y configura los parametros del modelo para generar un pronostico de demanda.
            </Typography>
          </Paper>
        )}
      </Box>
    </Layout>
  )
}
