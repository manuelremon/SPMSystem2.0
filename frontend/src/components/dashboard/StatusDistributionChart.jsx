/**
 * StatusDistributionChart - Doughnut Chart interactivo con Chart.js
 *
 * Features:
 * - Click en segmento para drill-down
 * - Tooltip con cantidad y porcentaje
 * - Animacion de highlight en hover
 * - Colores consistentes con SPM_COLORS
 */

import React, { forwardRef, useMemo, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { Doughnut } from 'react-chartjs-2'
import { STATUS_COLORS, CHART_PALETTE, TOOLTIP_CONFIG, ANIMATION_CONFIG, FONT_SIZES } from '../ui/SPMChartJS'

/**
 * Componente principal StatusDistributionChart
 */
export const StatusDistributionChart = forwardRef(function StatusDistributionChart({
  data = [],
  onDrillDown = null,
  height = 180,
  showLegend = true,
  innerRadius = 45,
  outerRadius = 70,
}, ref) {
  const chartRef = useRef(null)

  // Preparar datos para Doughnut
  const pieData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Esperar array de objetos { id, label, value, color? }
    return data
      .filter(item => item.value > 0)
      .map((item, index) => ({
        id: item.id || index,
        value: item.value,
        label: item.label,
        color: item.color || STATUS_COLORS[item.id] || CHART_PALETTE[index % CHART_PALETTE.length],
      }))
  }, [data])

  // Calcular total para mostrar en centro
  const total = useMemo(() => {
    return pieData.reduce((sum, item) => sum + item.value, 0)
  }, [pieData])

  // Preparar datos en formato Chart.js
  const chartData = useMemo(() => {
    if (pieData.length === 0) return { labels: [], datasets: [] }

    return {
      labels: pieData.map(d => d.label),
      datasets: [{
        data: pieData.map(d => d.value),
        backgroundColor: pieData.map(d => d.color),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 8,
        hoverBorderWidth: 3,
      }],
    }
  }, [pieData])

  // Calcular cutout basado en innerRadius/outerRadius ratio
  const cutoutPercentage = useMemo(() => {
    return `${Math.round((innerRadius / outerRadius) * 100)}%`
  }, [innerRadius, outerRadius])

  // Handler para click en segmento
  const handleChartClick = useCallback((event) => {
    if (!onDrillDown || !chartRef.current) return

    const chart = chartRef.current
    const elements = chart.getElementsAtEventForMode(event.nativeEvent, 'nearest', { intersect: true }, false)

    if (elements.length > 0) {
      const index = elements[0].index
      const item = pieData[index]
      if (item) {
        onDrillDown(item.id, item)
      }
    }
  }, [onDrillDown, pieData])

  // Opciones de Chart.js con configuración unificada
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: cutoutPercentage,
    animation: ANIMATION_CONFIG,
    plugins: {
      legend: {
        display: false, // Usamos leyenda custom
      },
      tooltip: {
        ...TOOLTIP_CONFIG,
        callbacks: {
          label: (context) => {
            const value = context.parsed
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
            return `${context.label}: ${value} (${percentage}%)`
          },
        },
      },
    },
    onHover: (event, elements) => {
      const canvas = event.native?.target
      if (canvas) {
        canvas.style.cursor = elements.length > 0 && onDrillDown ? 'pointer' : 'default'
      }
    },
  }), [cutoutPercentage, total, onDrillDown])

  if (pieData.length === 0) {
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
          Sin datos disponibles
        </Typography>
      </Box>
    )
  }

  return (
    <Box ref={ref} sx={{ position: 'relative', height, width: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ height: '100%' }}>
        {/* Leyenda a la izquierda - estilo uniforme */}
        {showLegend && (
          <Stack spacing={0.5} sx={{ minWidth: 100 }}>
            {pieData.map((item) => (
              <Stack
                key={item.id}
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{
                  cursor: onDrillDown ? 'pointer' : 'default',
                  '&:hover': onDrillDown ? { opacity: 0.8 } : {},
                }}
                onClick={() => onDrillDown && onDrillDown(item.id, item)}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: item.color,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm, lineHeight: 1 }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, color: item.color, fontSize: FONT_SIZES.sm, lineHeight: 1 }}
                >
                  {item.value}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}

        {/* Doughnut Chart */}
        <Box sx={{ position: 'relative', width: 150, height: '100%', flexShrink: 0 }}>
          <Doughnut
            ref={chartRef}
            data={chartData}
            options={chartOptions}
            onClick={handleChartClick}
          />
          {/* Total en el centro */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, lineHeight: 1, color: 'text.primary' }}
            >
              {total}
            </Typography>
          </Box>
        </Box>
      </Stack>
    </Box>
  )
})

export default StatusDistributionChart
