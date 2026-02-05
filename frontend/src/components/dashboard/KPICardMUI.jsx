/**
 * KPICardMUI - Tarjeta KPI profesional con MUI
 *
 * Features:
 * - Paper con elevation y hover effects
 * - Typography jerarquizada
 * - SPMSparkline integrado (Chart.js)
 * - Badge de comparativa periodo anterior
 * - Click handler para drill-down
 */

import React from 'react'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { SPMSparkline, SPM_COLORS } from '../ui/SPMChartJS'

/**
 * Sparkline compacto para KPI cards
 */
function KPISparkline({ data, height = 40, positive = true }) {
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">
          Sin datos
        </Typography>
      </Box>
    )
  }

  const values = data.map(v => Number(v) || 0)
  const color = positive ? SPM_COLORS.success : SPM_COLORS.error

  return (
    <Box sx={{ width: '100%', height }}>
      <SPMSparkline
        data={values}
        height={height}
        width="100%"
        color={color}
        showArea
      />
    </Box>
  )
}

/**
 * Componente principal KPICardMUI
 */
export function KPICardMUI({
  title,
  value,
  subtitle,
  trend = [],
  comparison = null, // { value: 15, period: 'mes' }
  icon: Icon = null,
  iconColor = SPM_COLORS.primary,
  onClick = null,
  sparklinePositive = true,
  valueColor = 'text.primary',
  compact = false,
}) {
  // Determinar si la tendencia es positiva
  const trendValue = comparison?.value ?? 0
  const isPositive = trendValue >= 0
  const TrendIcon = trendValue > 0 ? TrendingUpIcon : trendValue < 0 ? TrendingDownIcon : TrendingFlatIcon
  const trendColor = isPositive ? 'success' : 'error'

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: compact ? 2 : 2.5,
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        bgcolor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.1)',
          borderColor: 'primary.light',
        } : {},
      }}
    >
      <Stack spacing={1.5} sx={{ height: '100%' }}>
        {/* Header con titulo e icono */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontSize: '0.65rem',
            }}
          >
            {title}
          </Typography>
          {Icon && (
            <Box
              sx={{
                p: 0.5,
                borderRadius: 1,
                bgcolor: `${iconColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon sx={{ fontSize: 16, color: iconColor }} />
            </Box>
          )}
        </Stack>

        {/* Valor principal */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: valueColor,
            lineHeight: 1,
            fontSize: compact ? '1.5rem' : '1.75rem',
          }}
        >
          {value}
        </Typography>

        {/* Subtitle si existe */}
        {subtitle && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {subtitle}
          </Typography>
        )}

        {/* Sparkline */}
        {trend.length > 0 && (
          <Box sx={{ flexGrow: 1, minHeight: 40 }}>
            <KPISparkline data={trend} height={40} positive={sparklinePositive} />
          </Box>
        )}

        {/* Badge de comparativa */}
        {comparison && comparison.value !== undefined && comparison.value !== null && (
          <Chip
            size="small"
            icon={<TrendIcon sx={{ fontSize: 14 }} />}
            label={`${trendValue > 0 ? '+' : ''}${trendValue}% vs ${comparison.period || 'periodo anterior'}`}
            color={trendColor}
            variant="outlined"
            sx={{
              alignSelf: 'flex-start',
              fontSize: '0.65rem',
              height: 22,
              '& .MuiChip-icon': {
                marginLeft: '4px',
              },
            }}
          />
        )}
      </Stack>
    </Paper>
  )
}

export default KPICardMUI
