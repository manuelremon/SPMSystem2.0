/**
 * TrendChart - Grafico de tendencia historica con Chart.js
 *
 * Features:
 * - SPMLine/SPMArea con areas apiladas
 * - Evolucion mensual de solicitudes
 * - Leyenda interactiva
 * - Tooltip detallado
 */

import React, { forwardRef, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { SPMLine, SPMArea, TREND_COLORS, SPM_COLORS, TOOLTIP_CONFIG, ANIMATION_CONFIG, LEGEND_CONFIG } from '../ui/SPMChartJS'

// Colores por serie - usando colores unificados
const SERIES_COLORS = {
  aprobadas: TREND_COLORS.aprobadas,
  rechazadas: TREND_COLORS.rechazadas,
  pendientes: TREND_COLORS.pendientes,
  total: SPM_COLORS.primary,
}

/**
 * Componente principal TrendChart
 */
export const TrendChart = forwardRef(function TrendChart({
  data = null,
  height = 280,
  showLegend = true,
  showGrid = true,
  showArea = true,
}, ref) {
  // Preparar datos para Chart.js
  const chartConfig = useMemo(() => {
    if (!data) return null

    // Esperar objeto con { meses: [], aprobadas: [], rechazadas: [], pendientes: [] }
    const { meses = [], aprobadas = [], rechazadas = [], pendientes = [] } = data

    if (meses.length === 0) return null

    const datasets = []

    // Dataset aprobadas
    if (aprobadas.length > 0) {
      datasets.push({
        data: aprobadas,
        label: 'Aprobadas',
        borderColor: SERIES_COLORS.aprobadas,
        backgroundColor: showArea ? `${SERIES_COLORS.aprobadas}20` : 'transparent',
        fill: showArea,
        tension: 0.4,
        pointRadius: 0,
      })
    }

    // Dataset pendientes
    if (pendientes.length > 0) {
      datasets.push({
        data: pendientes,
        label: 'Pendientes',
        borderColor: SERIES_COLORS.pendientes,
        backgroundColor: showArea ? `${SERIES_COLORS.pendientes}20` : 'transparent',
        fill: showArea,
        tension: 0.4,
        pointRadius: 0,
      })
    }

    // Dataset rechazadas
    if (rechazadas.length > 0) {
      datasets.push({
        data: rechazadas,
        label: 'Rechazadas',
        borderColor: SERIES_COLORS.rechazadas,
        backgroundColor: showArea ? `${SERIES_COLORS.rechazadas}20` : 'transparent',
        fill: showArea,
        tension: 0.4,
        pointRadius: 0,
      })
    }

    return {
      labels: meses,
      datasets,
    }
  }, [data, showArea])

  if (!chartConfig || chartConfig.datasets.length === 0) {
    return (
      <Box
        ref={ref}
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" color="text.disabled">
          Sin datos de tendencia disponibles
        </Typography>
      </Box>
    )
  }

  // Opciones personalizadas para el grafico con configuración unificada
  const chartOptions = {
    animation: ANIMATION_CONFIG,
    plugins: {
      legend: showLegend ? {
        ...LEGEND_CONFIG,
        display: true,
        position: 'top',
        align: 'center',
      } : { display: false },
      tooltip: TOOLTIP_CONFIG,
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 10 },
        },
      },
      y: {
        grid: {
          display: showGrid,
        },
        beginAtZero: true,
      },
    },
  }

  // Usar SPMArea si showArea es true, sino SPMLine
  const ChartComponent = showArea ? SPMArea : SPMLine

  return (
    <Box ref={ref} sx={{ width: '100%', height }}>
      <ChartComponent
        labels={chartConfig.labels}
        datasets={chartConfig.datasets}
        height={height}
        options={chartOptions}
      />
    </Box>
  )
})

/**
 * Hook para calcular datos de tendencia desde solicitudes
 */
export function useTrendData(solicitudes, mesesAtras = 12) {
  return useMemo(() => {
    if (!solicitudes || solicitudes.length === 0) {
      return null
    }

    const ahora = new Date()
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    // Inicializar contadores por mes
    const meses = []
    const aprobadas = []
    const rechazadas = []
    const pendientes = []

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      const mes = `${mesesNombres[fecha.getMonth()]} ${String(fecha.getFullYear()).slice(-2)}`
      meses.push(mes)

      const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
      const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999)

      let countAprobadas = 0
      let countRechazadas = 0
      let countPendientes = 0

      solicitudes.forEach(s => {
        const fechaCreacion = new Date(s.created_at || s.fecha_creacion)
        if (fechaCreacion >= inicioMes && fechaCreacion <= finMes) {
          const estado = (s.estado || s.status || '').toLowerCase()
          if (estado.includes('aprobada') || estado === 'approved') {
            countAprobadas++
          } else if (estado.includes('rechazada') || estado === 'rejected') {
            countRechazadas++
          } else if (estado.includes('enviada') || estado.includes('pendiente') || estado === 'submitted') {
            countPendientes++
          }
        }
      })

      aprobadas.push(countAprobadas)
      rechazadas.push(countRechazadas)
      pendientes.push(countPendientes)
    }

    return { meses, aprobadas, rechazadas, pendientes }
  }, [solicitudes, mesesAtras])
}

export default TrendChart
