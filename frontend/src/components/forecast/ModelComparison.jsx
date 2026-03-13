/**
 * ModelComparison - Comparacion de modelos de forecast con Chart.js
 *
 * Muestra ranking y metricas comparativas de multiples modelos
 */

import React, { useMemo } from 'react';
import { SPMBar } from '../ui/SPMChartJS';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
} from '@mui/material';
import { useI18n } from '../../context/i18n';

const MODELOS_NOMBRES = {
  random_forest: 'Random Forest',
  gradient_boosting: 'Gradient Boosting',
  linear: 'Regresion Lineal',
  xgboost: 'XGBoost',
  prophet: 'Prophet',
  arima: 'ARIMA'
};

// Colores MUI oficial
const COLORS = {
  mejor: 'var(--success-text)',     // MUI Green 800
  normal: 'var(--primary)',    // MUI Blue 700
};

const ModelComparison = ({
  data,
  loading = false,
  onSelectModel,
}) => {
  const { t } = useI18n();

  // Preparar datos del grafico
  const chartData = useMemo(() => {
    if (!data?.ranking) return { labels: [], values: [], colors: [] };

    const labels = data.ranking.map(r => MODELOS_NOMBRES[r.modelo] || r.modelo);
    const values = data.ranking.map(r => r.mae || 0);
    const colors = data.ranking.map(r =>
      r.modelo === data.mejor_modelo ? COLORS.mejor : COLORS.normal
    );

    return { labels, values, colors };
  }, [data]);

  if (loading) {
    return (
      <Paper sx={{ p: 3, border: 1, borderColor: 'divider' }}>
        <Skeleton variant="text" width={192} height={28} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={256} sx={{ mb: 2 }} />
        <Stack spacing={1}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </Stack>
      </Paper>
    );
  }

  if (!data) {
    return null;
  }

  const { ranking, mejor_modelo, recomendacion } = data;

  return (
    <Paper sx={{ p: 3, border: 1, borderColor: 'divider' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          {t('forecast_comparacion_modelos', 'Comparacion de Modelos')}
        </Typography>
        {mejor_modelo && (
          <Chip
            label={`Mejor: ${MODELOS_NOMBRES[mejor_modelo] || mejor_modelo}`}
            size="small"
            color="success"
            sx={{ fontWeight: 500 }}
          />
        )}
      </Stack>

      {/* Recomendacion */}
      {recomendacion && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {recomendacion}
        </Alert>
      )}

      {/* Grafico de barras */}
      {ranking && ranking.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <SPMBar
            labels={chartData.labels}
            datasets={[{
              label: 'MAE',
              data: chartData.values,
              backgroundColor: chartData.colors,
            }]}
            height={280}
            options={{
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const value = context.parsed.y;
                      return value != null ? value.toFixed(2) : '-';
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                },
                y: {
                  grid: { color: 'rgba(0, 0, 0, 0.06)' },
                  beginAtZero: true,
                },
              },
            }}
          />
        </Box>
      )}

      {/* Tabla de ranking */}
      {ranking && ranking.length > 0 && (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ overflow: 'hidden' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell align="center" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', color: 'text.secondary' }}>
                  #
                </TableCell>
                <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', color: 'text.secondary' }}>
                  Modelo
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', color: 'text.secondary' }}>
                  MAE
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', color: 'text.secondary' }}>
                  RMSE
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', color: 'text.secondary' }}>
                  R2
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', color: 'text.secondary' }}>
                  Accion
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ranking.map((r, i) => (
                <TableRow
                  key={r.modelo}
                  sx={{
                    bgcolor: r.modelo === mejor_modelo ? 'success.50' : 'inherit',
                    '&:last-child td, &:last-child th': { border: 0 }
                  }}
                >
                  <TableCell align="center">
                    {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : r.posicion}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {MODELOS_NOMBRES[r.modelo] || r.modelo}
                    {r.modelo === mejor_modelo && (
                      <Typography component="span" variant="caption" sx={{ ml: 1, color: 'success.main' }}>
                        (Recomendado)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {r.mae?.toFixed(2)}
                    {r.mae_std && (
                      <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>
                        +/-{r.mae_std.toFixed(2)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {r.rmse?.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {r.r2?.toFixed(4)}
                  </TableCell>
                  <TableCell align="center">
                    {onSelectModel && (
                      <Button
                        onClick={() => onSelectModel(r.modelo)}
                        variant="outlined"
                        size="small"
                        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                      >
                        Usar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default ModelComparison;
