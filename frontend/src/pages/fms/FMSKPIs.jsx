import React, { useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import {
  Truck,
  ClipboardList,
  DollarSign,
  FileText,
  Settings,
  Gauge,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Play,
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useFmsStore } from '../../store/fmsStore'
import * as fmsService from '../../services/fms'

const BORDER_COLORS = {
  vehicles: '#2196f3',
  workorders: '#ff9800',
  cost: '#4caf50',
  documents: '#f44336',
  maintenance: '#9c27b0',
  fuel: '#00bcd4',
}

function KpiCard({ icon: Icon, label, value, subtitle, borderColor, children }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderLeft: `4px solid ${borderColor}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: `${borderColor}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ color: borderColor, fontSize: 24 }} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {children}
        </Box>
      </Stack>
    </Paper>
  )
}

export default function FMSKPIs() {
  const { t } = useI18n()
  const { kpis, kpisLoading, fetchKpis } = useFmsStore()

  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState(null)
  const [evalError, setEvalError] = useState(null)

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true)
    setEvalError(null)
    setEvalResult(null)
    try {
      const res = await fmsService.evaluatePreventiveMaintenance()
      if (res.ok) {
        setEvalResult(res.data)
        // Refresh KPIs after evaluation
        fetchKpis()
      } else {
        setEvalError(res.error || 'Error al evaluar mantenimiento')
      }
    } catch (err) {
      setEvalError(err.message)
    }
    setEvaluating(false)
  }, [fetchKpis])

  const data = kpis || {}

  // Derived values with safe defaults
  const totalVehicles = data.total_vehicles || 0
  const availableVehicles = data.available_vehicles || 0
  const availablePct = totalVehicles > 0 ? Math.round((availableVehicles / totalVehicles) * 100) : 0

  const openWorkOrders = data.open_work_orders || 0
  const criticalWOs = data.critical_work_orders || 0

  const avgCost = data.avg_cost_per_wo || 0
  const expiringDocs = data.expiring_documents || 0
  const upcomingMaint = data.upcoming_maintenance || 0
  const avgFuel = data.avg_fuel_efficiency || 0

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {t('fms_kpis_title', 'Dashboard FMS')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fms_kpis_subtitle', 'Indicadores clave de la flota')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshCw />}
            onClick={() => fetchKpis()}
            disabled={kpisLoading}
          >
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={evaluating ? <CircularProgress size={18} color="inherit" /> : <Play />}
            onClick={handleEvaluate}
            disabled={evaluating}
          >
            Evaluar Mantenimiento
          </Button>
        </Stack>
      </Stack>

      {kpisLoading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {evalError && <Alert severity="error" sx={{ mb: 2 }}>{evalError}</Alert>}

      {evalResult && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Evaluacion completada. {evalResult.work_orders_created || 0} ordenes de trabajo preventivas creadas.
          {evalResult.vehicles_evaluated ? ` ${evalResult.vehicles_evaluated} vehiculos evaluados.` : ''}
        </Alert>
      )}

      {!kpisLoading && (
        <Grid container spacing={3}>
          {/* Vehiculos Disponibles */}
          <Grid item xs={12} sm={6} md={4}>
            <KpiCard
              icon={Truck}
              label="Vehiculos Disponibles"
              value={`${availableVehicles} / ${totalVehicles}`}
              subtitle={`${availablePct}% de disponibilidad`}
              borderColor={BORDER_COLORS.vehicles}
            >
              <LinearProgress
                variant="determinate"
                value={availablePct}
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: availablePct >= 80 ? 'success.main' : availablePct >= 50 ? 'warning.main' : 'error.main',
                  },
                }}
              />
            </KpiCard>
          </Grid>

          {/* OTs Abiertas */}
          <Grid item xs={12} sm={6} md={4}>
            <KpiCard
              icon={ClipboardList}
              label="OTs Abiertas"
              value={openWorkOrders}
              borderColor={BORDER_COLORS.workorders}
            >
              {criticalWOs > 0 && (
                <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                  <AlertTriangle sx={{ fontSize: 16, color: 'error.main' }} />
                  <Typography variant="body2" color="error.main" fontWeight={600}>
                    {criticalWOs} critica{criticalWOs !== 1 ? 's' : ''}
                  </Typography>
                </Stack>
              )}
            </KpiCard>
          </Grid>

          {/* Costo Promedio */}
          <Grid item xs={12} sm={6} md={4}>
            <KpiCard
              icon={DollarSign}
              label="Costo Promedio por OT"
              value={avgCost > 0 ? `$${Number(avgCost).toLocaleString()}` : '--'}
              subtitle={data.total_cost ? `Total: $${Number(data.total_cost).toLocaleString()}` : ''}
              borderColor={BORDER_COLORS.cost}
            />
          </Grid>

          {/* Documentos por Vencer */}
          <Grid item xs={12} sm={6} md={4}>
            <KpiCard
              icon={FileText}
              label="Documentos por Vencer"
              value={expiringDocs}
              subtitle="Proximos 30 dias"
              borderColor={BORDER_COLORS.documents}
            >
              {expiringDocs > 0 && (
                <Chip
                  label="Requiere atencion"
                  color="error"
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              )}
            </KpiCard>
          </Grid>

          {/* Mantenimientos Proximos */}
          <Grid item xs={12} sm={6} md={4}>
            <KpiCard
              icon={Settings}
              label="Mantenimientos Proximos"
              value={upcomingMaint}
              subtitle="Proximos 30 dias / 5,000 km"
              borderColor={BORDER_COLORS.maintenance}
            >
              {upcomingMaint > 0 && (
                <Chip
                  label="Programados"
                  color="info"
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              )}
            </KpiCard>
          </Grid>

          {/* Rendimiento Combustible */}
          <Grid item xs={12} sm={6} md={4}>
            <KpiCard
              icon={Gauge}
              label="Rendimiento Combustible Promedio"
              value={avgFuel > 0 ? `${Number(avgFuel).toFixed(1)} km/l` : '--'}
              subtitle="Promedio de la flota"
              borderColor={BORDER_COLORS.fuel}
            >
              {avgFuel > 0 && (
                <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                  {avgFuel >= 8 ? (
                    <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                  ) : (
                    <AlertTriangle sx={{ fontSize: 16, color: 'warning.main' }} />
                  )}
                  <Typography variant="body2" color={avgFuel >= 8 ? 'success.main' : 'warning.main'}>
                    {avgFuel >= 8 ? 'Eficiente' : 'Bajo rendimiento'}
                  </Typography>
                </Stack>
              )}
            </KpiCard>
          </Grid>
        </Grid>
      )}

      {/* Additional stats row */}
      {!kpisLoading && data.vehicles_by_status && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>Vehiculos por Estado</Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {Object.entries(data.vehicles_by_status).map(([status, count]) => {
              const statusColors = {
                disponible: 'success',
                en_ruta: 'primary',
                en_mantenimiento: 'warning',
                fuera_servicio: 'error',
                baja: 'default',
              }
              return (
                <Chip
                  key={status}
                  label={`${status.replace(/_/g, ' ')}: ${count}`}
                  color={statusColors[status] || 'default'}
                  variant="outlined"
                />
              )
            })}
          </Stack>
        </Paper>
      )}

      {!kpisLoading && data.work_orders_by_type && (
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>OTs por Tipo</Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {Object.entries(data.work_orders_by_type).map(([tipo, count]) => {
              const typeColors = {
                preventivo: 'info',
                correctivo: 'default',
                emergencia: 'error',
              }
              return (
                <Chip
                  key={tipo}
                  label={`${tipo}: ${count}`}
                  color={typeColors[tipo] || 'default'}
                  variant="outlined"
                />
              )
            })}
          </Stack>
        </Paper>
      )}
    </Box>
  )
}
