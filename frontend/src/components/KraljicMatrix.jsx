/**
 * KraljicMatrix - 2x2 scatter matrix for strategic sourcing classification
 *
 * Renders a CSS grid with 4 quadrants:
 *   - Strategic (high risk, high impact)
 *   - Leverage (low risk, high impact)
 *   - Bottleneck (high risk, low impact)
 *   - Non-critical (low risk, low impact)
 *
 * Each item is positioned as a dot within its quadrant.
 * Tooltip on hover shows the category name.
 */

import { useMemo } from 'react';
import { useI18n } from '../context/i18n';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

const QUADRANT_CONFIG = {
  strategic: {
    label: 'Estrat\u00e9gico',
    i18nKey: 'kraljic_strategic',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.20)',
  },
  leverage: {
    label: 'Apalancamiento',
    i18nKey: 'kraljic_leverage',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.06)',
    borderColor: 'rgba(59, 130, 246, 0.20)',
  },
  bottleneck: {
    label: 'Cuello de Botella',
    i18nKey: 'kraljic_bottleneck',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.06)',
    borderColor: 'rgba(249, 115, 22, 0.20)',
  },
  'non-critical': {
    label: 'No Cr\u00edtico',
    i18nKey: 'kraljic_noncritical',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.06)',
    borderColor: 'rgba(34, 197, 94, 0.20)',
  },
};

function classifyItem(item) {
  const risk = Number(item.supply_risk) || 0;
  const impact = Number(item.profit_impact) || 0;

  // Use explicit classification if available, otherwise classify by thresholds
  if (item.clasificacion) {
    const key = item.clasificacion.toLowerCase().replace(/[ _]/g, '-');
    if (QUADRANT_CONFIG[key]) return key;
  }

  if (risk >= 50 && impact >= 50) return 'strategic';
  if (risk < 50 && impact >= 50) return 'leverage';
  if (risk >= 50 && impact < 50) return 'bottleneck';
  return 'non-critical';
}

function QuadrantCell({ config, items, t }) {
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: config.bgColor,
        border: '1px solid',
        borderColor: config.borderColor,
        p: 1.5,
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: config.color,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          mb: 1,
        }}
      >
        {t(config.i18nKey, config.label)}
      </Typography>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 100 }}>
        {items.map((item, idx) => {
          // Normalize position within quadrant (0-100 range mapped to quadrant)
          const risk = Number(item.supply_risk) || 0;
          const impact = Number(item.profit_impact) || 0;

          // Map to relative position within the quadrant area
          const xPct = Math.min(Math.max((risk % 50) * 2, 5), 85);
          const yPct = Math.min(Math.max(100 - ((impact % 50) * 2), 5), 85);

          return (
            <Tooltip
              key={item.categoria || idx}
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.categoria}
                  </Typography>
                  <Typography variant="caption">
                    {t('kraljic_risk', 'Riesgo')}: {risk.toFixed(0)} | {t('kraljic_impact', 'Impacto')}: {impact.toFixed(0)}
                  </Typography>
                </Box>
              }
              arrow
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: config.color,
                  border: '2px solid white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                  '&:hover': {
                    transform: 'scale(1.4)',
                    zIndex: 10,
                  },
                }}
                role="img"
                aria-label={`${item.categoria}: ${t('kraljic_risk', 'Riesgo')} ${risk.toFixed(0)}, ${t('kraljic_impact', 'Impacto')} ${impact.toFixed(0)}`}
              />
            </Tooltip>
          );
        })}
      </Box>
      {items.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Typography>
      )}
    </Box>
  );
}

export default function KraljicMatrix({ data }) {
  const { t } = useI18n();

  const grouped = useMemo(() => {
    const groups = {
      strategic: [],
      leverage: [],
      bottleneck: [],
      'non-critical': [],
    };

    (data || []).forEach(item => {
      const quadrant = classifyItem(item);
      groups[quadrant].push(item);
    });

    return groups;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t('kraljic_no_data', 'Sin datos para la matriz de Kraljic')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto' }}>
      {/* Axis Labels */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('kraljic_axis_impact', 'Impacto en Beneficio')} &rarr;
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {/* Y-axis label */}
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
            }}
          >
            {t('kraljic_axis_risk', 'Riesgo de Suministro')} &rarr;
          </Typography>
        </Box>

        {/* 2x2 Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 0.5,
            flex: 1,
          }}
        >
          {/* Top-left: Bottleneck (high risk, low impact) */}
          <QuadrantCell
            config={QUADRANT_CONFIG.bottleneck}
            items={grouped.bottleneck}
            t={t}
          />
          {/* Top-right: Strategic (high risk, high impact) */}
          <QuadrantCell
            config={QUADRANT_CONFIG.strategic}
            items={grouped.strategic}
            t={t}
          />
          {/* Bottom-left: Non-critical (low risk, low impact) */}
          <QuadrantCell
            config={QUADRANT_CONFIG['non-critical']}
            items={grouped['non-critical']}
            t={t}
          />
          {/* Bottom-right: Leverage (low risk, high impact) */}
          <QuadrantCell
            config={QUADRANT_CONFIG.leverage}
            items={grouped.leverage}
            t={t}
          />
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2, flexWrap: 'wrap' }}>
        {Object.entries(QUADRANT_CONFIG).map(([key, cfg]) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cfg.color }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {t(cfg.i18nKey, cfg.label)} ({grouped[key].length})
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
