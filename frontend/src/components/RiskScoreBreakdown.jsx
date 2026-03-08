/**
 * RiskScoreBreakdown - Horizontal bar breakdown of supplier risk dimensions
 *
 * Renders 5 horizontal bars (one per risk dimension) on a 0-100 scale,
 * color-coded by severity. Shows overall score prominently with a nivel badge.
 *
 * Props:
 *   risk: {
 *     riesgo_financiero, riesgo_entrega, riesgo_calidad,
 *     riesgo_dependencia, riesgo_geografico,
 *     score_riesgo, nivel
 *   }
 */

import { useI18n } from '../context/i18n';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';

const NIVEL_COLORS = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const NIVEL_LABELS = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
};

function getBarColor(value) {
  const v = Number(value) || 0;
  if (v <= 25) return '#22c55e';
  if (v <= 50) return '#eab308';
  if (v <= 75) return '#f97316';
  return '#ef4444';
}

function getBarBgColor(value) {
  const v = Number(value) || 0;
  if (v <= 25) return 'rgba(34, 197, 94, 0.12)';
  if (v <= 50) return 'rgba(234, 179, 8, 0.12)';
  if (v <= 75) return 'rgba(249, 115, 22, 0.12)';
  return 'rgba(239, 68, 68, 0.12)';
}

const DIMENSIONS = [
  { key: 'riesgo_financiero', i18nKey: 'risk_dim_financiero', label: 'Financiero' },
  { key: 'riesgo_entrega', i18nKey: 'risk_dim_entrega', label: 'Entrega' },
  { key: 'riesgo_calidad', i18nKey: 'risk_dim_calidad', label: 'Calidad' },
  { key: 'riesgo_dependencia', i18nKey: 'risk_dim_dependencia', label: 'Dependencia' },
  { key: 'riesgo_geografico', i18nKey: 'risk_dim_geografico', label: 'Geografico' },
];

export default function RiskScoreBreakdown({ risk }) {
  const { t } = useI18n();

  if (!risk) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('risk_no_data', 'Sin datos de riesgo disponibles')}
        </Typography>
      </Box>
    );
  }

  const overallScore = Number(risk.score_riesgo) || 0;
  const nivel = risk.nivel || 'low';

  return (
    <Box>
      {/* Overall Score */}
      <Box
        sx={{
          textAlign: 'center',
          mb: 3,
          p: 2,
          bgcolor: getBarBgColor(overallScore),
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          {t('risk_overall_score', 'Score de Riesgo Global')}
        </Typography>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            color: getBarColor(overallScore),
            mt: 0.5,
            lineHeight: 1.2,
          }}
        >
          {overallScore.toFixed(1)}
        </Typography>
        <Chip
          size="small"
          label={NIVEL_LABELS[nivel] || nivel}
          color={NIVEL_COLORS[nivel] || 'default'}
          variant={nivel === 'critical' ? 'filled' : 'outlined'}
          sx={{ mt: 1 }}
        />
      </Box>

      {/* Dimension Bars */}
      <Stack spacing={2}>
        {DIMENSIONS.map((dim) => {
          const value = Number(risk[dim.key]) || 0;
          const barColor = getBarColor(value);

          return (
            <Box key={dim.key}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {t(dim.i18nKey, dim.label)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, color: barColor, minWidth: 36, textAlign: 'right' }}
                >
                  {value.toFixed(0)}
                </Typography>
              </Stack>

              {/* Bar track */}
              <Box
                sx={{
                  position: 'relative',
                  height: 10,
                  bgcolor: 'grey.200',
                  overflow: 'hidden',
                }}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${t(dim.i18nKey, dim.label)}: ${value.toFixed(0)}`}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${Math.min(value, 100)}%`,
                    bgcolor: barColor,
                    transition: 'width 0.5s ease-in-out',
                  }}
                />
                {/* Scale markers at 25, 50, 75 */}
                {[25, 50, 75].map(mark => (
                  <Box
                    key={mark}
                    sx={{
                      position: 'absolute',
                      left: `${mark}%`,
                      top: 0,
                      width: 1,
                      height: '100%',
                      bgcolor: 'rgba(0,0,0,0.08)',
                    }}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Stack>

      {/* Legend */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, px: 0.5 }}>
        {[
          { label: '0-25', color: '#22c55e', text: t('risk_legend_low', 'Bajo') },
          { label: '25-50', color: '#eab308', text: t('risk_legend_medium', 'Medio') },
          { label: '50-75', color: '#f97316', text: t('risk_legend_high', 'Alto') },
          { label: '75-100', color: '#ef4444', text: t('risk_legend_critical', 'Critico') },
        ].map(item => (
          <Stack key={item.label} direction="row" alignItems="center" gap={0.3}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
            <Typography variant="caption" color="text.secondary">{item.text}</Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}
