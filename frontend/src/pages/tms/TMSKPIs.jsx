import React, { useEffect } from 'react'
import {
  Box, Typography, Paper, Grid, CircularProgress, Alert, IconButton, Chip
} from '@mui/material'
import {
  Truck, Package, DollarSign, Clock, CheckCircle, AlertTriangle,
  RefreshCw, TrendingUp, Gauge, Activity
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore, useTmsKpis } from '../../store/tmsStore'

const KPI_CONFIGS = [
  {
    key: 'envios_activos',
    label: 'tms_kpi_active_shipments',
    fallback: 'Envios Activos',
    icon: Truck,
    color: '#1976d2',
    format: 'number',
  },
  {
    key: 'entregas_a_tiempo_pct',
    label: 'tms_kpi_on_time',
    fallback: 'Entregas a Tiempo',
    icon: CheckCircle,
    color: '#2e7d32',
    format: 'percent',
  },
  {
    key: 'costo_promedio_envio',
    label: 'tms_kpi_avg_cost',
    fallback: 'Costo Promedio / Envio',
    icon: DollarSign,
    color: '#ed6c02',
    format: 'currency',
  },
  {
    key: 'tiempo_promedio_entrega_hrs',
    label: 'tms_kpi_avg_delivery_time',
    fallback: 'Tiempo Promedio Entrega',
    icon: Clock,
    color: '#0288d1',
    format: 'hours',
  },
  {
    key: 'incidentes_mes',
    label: 'tms_kpi_incidents',
    fallback: 'Incidentes del Mes',
    icon: AlertTriangle,
    color: '#d32f2f',
    format: 'number',
  },
  {
    key: 'margen_promedio_pct',
    label: 'tms_kpi_avg_margin',
    fallback: 'Margen Promedio',
    icon: TrendingUp,
    color: '#7b1fa2',
    format: 'percent',
  },
]

function formatKpiValue(value, format) {
  if (value == null || value === undefined) return '-'
  switch (format) {
    case 'currency':
      return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':
      return `${Number(value).toFixed(1)}%`
    case 'hours':
      return `${Number(value).toFixed(1)} hrs`
    case 'number':
    default:
      return Number(value).toLocaleString()
  }
}

export default function TMSKPIs() {
  const { t } = useI18n()
  const kpis = useTmsKpis()
  const kpisLoading = useTmsStore(s => s.kpisLoading)
  const fetchKpis = useTmsStore(s => s.fetchKpis)

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Gauge sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={600}>
            {t('tms_kpis_title', 'KPIs de Transporte')}
          </Typography>
        </Box>
        <IconButton onClick={() => fetchKpis()} title={t('common_refresh', 'Refrescar')}>
          <RefreshCw />
        </IconButton>
      </Box>

      {kpisLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !kpis ? (
        <Alert severity="info">
          {t('tms_kpis_no_data', 'No hay datos de KPIs disponibles')}
        </Alert>
      ) : (
        <>
          {/* KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {KPI_CONFIGS.map(config => {
              const IconComponent = config.icon
              const value = kpis[config.key]
              return (
                <Grid item xs={12} sm={6} md={4} key={config.key}>
                  <Paper
                    sx={{
                      p: 3,
                      borderTop: `4px solid ${config.color}`,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                    elevation={2}
                  >
                    <IconComponent sx={{ fontSize: 40, color: config.color, mb: 1.5 }} />
                    <Typography variant="h4" fontWeight={700} sx={{ color: config.color, mb: 0.5 }}>
                      {formatKpiValue(value, config.format)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(config.label, config.fallback)}
                    </Typography>
                  </Paper>
                </Grid>
              )
            })}
          </Grid>

          {/* Additional metrics */}
          {kpis.resumen && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <Activity sx={{ fontSize: 20, mr: 1, verticalAlign: 'text-bottom' }} />
                {t('tms_kpis_summary', 'Resumen del Periodo')}
              </Typography>
              <Grid container spacing={2}>
                {kpis.resumen.total_envios != null && (
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={600}>
                        {kpis.resumen.total_envios}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('tms_kpi_total_shipments', 'Total Envios')}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {kpis.resumen.total_entregados != null && (
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={600} color="success.main">
                        {kpis.resumen.total_entregados}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('tms_kpi_total_delivered', 'Entregados')}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {kpis.resumen.total_incidentes != null && (
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={600} color="error.main">
                        {kpis.resumen.total_incidentes}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('tms_kpi_total_incidents', 'Incidentes')}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {kpis.resumen.ingreso_total != null && (
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={600} color="primary.main">
                        ${Number(kpis.resumen.ingreso_total).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('tms_kpi_total_revenue', 'Ingreso Total')}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          {/* By-status breakdown */}
          {kpis.por_estado && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                <Package sx={{ fontSize: 20, mr: 1, verticalAlign: 'text-bottom' }} />
                {t('tms_kpis_by_status', 'Envios por Estado')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                {Object.entries(kpis.por_estado).map(([estado, count]) => (
                  <Chip
                    key={estado}
                    label={`${estado}: ${count}`}
                    variant="outlined"
                    sx={{ fontSize: '0.875rem' }}
                  />
                ))}
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  )
}
