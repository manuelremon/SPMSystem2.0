import { memo } from 'react';
import { useI18n } from '../../context/i18n';
import { FONT_SIZES } from '../../components/ui/SPMChartJS';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * MrpAlertsCard - Shows MRP critical alerts in KPIRow3.
 * Uses data from /api/dashboard-data/resumen (already fetched by AttentionBanner).
 */
function MrpAlertsCard({ resumen, onKpiDrillDown }) {
  const { t } = useI18n();

  const alertas = resumen?.alertas_mrp_detalle || [];
  const totalAlertas = resumen?.alertas_mrp || 0;
  const materialesCriticos = resumen?.materiales_criticos || 0;
  const bajoPuntoPedido = resumen?.bajo_punto_pedido || 0;

  return (
    <Paper
      elevation={0}
      onClick={() => onKpiDrillDown?.('stock_critico')}
      sx={{
        flex: 1,
        bgcolor: 'var(--surface)',
        border: '1px solid',
        borderColor: totalAlertas > 0 ? 'warning.light' : 'divider',
        borderRadius: 2,
        cursor: onKpiDrillDown ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {totalAlertas > 0 && <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
            {t('dash_mrp_alerts_title', 'Alertas MRP')}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        {/* Summary chips */}
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.5 }}>
          <Chip
            size="small"
            label={`${materialesCriticos} ${t('dash_mrp_alerts_critical', 'críticos')}`}
            color={materialesCriticos > 0 ? 'error' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
          <Chip
            size="small"
            label={`${bajoPuntoPedido} ${t('dash_mrp_alerts_below_rop', 'bajo punto pedido')}`}
            color={bajoPuntoPedido > 0 ? 'warning' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        </Stack>

        {/* Top 5 critical items */}
        <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.200' } }}>
          {alertas.length > 0 ? (
            alertas.slice(0, 5).map((item, idx) => (
              <Stack
                key={idx}
                direction="row"
                alignItems="center"
                gap={1}
                sx={{
                  py: 0.75,
                  px: 0.5,
                  mx: -0.5,
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'grey.400', width: 16, fontSize: FONT_SIZES.xs }}>
                  {idx + 1}.
                </Typography>
                <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace' }}>
                  {item.codigo || item.codigo_material || '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'grey.700', flex: 1 }}>
                  {item.descripcion || item.nombre || ''}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    width: 48,
                    textAlign: 'right',
                    color: (item.stock ?? item.stock_actual ?? 0) === 0 ? 'error.main' : 'warning.main',
                  }}
                >
                  {item.stock ?? item.stock_actual ?? 0}
                </Typography>
              </Stack>
            ))
          ) : (
            <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>
              {totalAlertas > 0
                ? t('dash_mrp_alerts_count', '{count} alertas activas').replace('{count}', totalAlertas)
                : t('dash_mrp_alerts_none', 'Sin alertas')}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

export default memo(MrpAlertsCard);
