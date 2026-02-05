/**
 * BacktestResults - Resultados de backtesting con AG Grid y Chart.js
 *
 * Muestra metricas y graficos de validacion walk-forward
 */

import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Skeleton,
} from '@mui/material';
import { useI18n } from '../../context/i18n';
import { SPMAgGrid } from '../ui/SPMAgGrid';
import { SPMBar, SPM_COLORS } from '../ui/SPMChartJS';

const BacktestResults = ({ data, loading = false }) => {
  const { t } = useI18n();

  // Preparar filas para el DataGrid
  const rows = useMemo(() => {
    if (!data?.steps) return [];
    return data.steps.map((step, i) => ({
      id: i,
      paso: i + 1,
      fecha_corte: new Date(step.fecha_corte),
      n_train: step.n_train,
      n_test: step.n_test,
      mae: step.mae,
      r2: step.r2,
    }));
  }, [data?.steps]);

  // Definir columnas para AG Grid
  const columnDefs = useMemo(() => [
    {
      field: 'paso',
      headerName: 'Paso',
      width: 80,
      type: 'numericColumn',
    },
    {
      field: 'fecha_corte',
      headerName: 'Fecha Corte',
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        return params.value.toLocaleDateString('es-ES');
      },
    },
    {
      field: 'n_train',
      headerName: 'Train',
      width: 90,
      type: 'numericColumn',
    },
    {
      field: 'n_test',
      headerName: 'Test',
      width: 90,
      type: 'numericColumn',
    },
    {
      field: 'mae',
      headerName: 'MAE',
      width: 100,
      type: 'numericColumn',
      cellRenderer: (params) => (
        <Typography variant="body2" fontWeight={500}>
          {params.value?.toFixed(2) || '-'}
        </Typography>
      ),
    },
    {
      field: 'r2',
      headerName: 'R2',
      width: 100,
      type: 'numericColumn',
      cellRenderer: (params) => (
        <Typography variant="body2" fontWeight={500}>
          {params.value?.toFixed(4) || '-'}
        </Typography>
      ),
    },
  ], []);

  if (loading) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2, border: 1, borderColor: 'divider' }}>
        <Skeleton variant="text" width={192} height={28} sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={256} />
      </Paper>
    );
  }

  if (!data) {
    return null;
  }

  const { metricas_agregadas, steps, es_estable } = data;

  // Datos para el grafico de metricas por paso (MUI X Charts)
  const chartData = useMemo(() => {
    if (!steps || steps.length === 0) return { labels: [], mae: [], rmse: [] };
    return {
      labels: steps.map((_, i) => `Paso ${i + 1}`),
      mae: steps.map(s => s.mae || 0),
      rmse: steps.map(s => s.rmse || 0),
    };
  }, [steps]);

  return (
    <Paper sx={{ p: 3, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          {t('forecast_backtest_resultados', 'Resultados de Backtesting')}
        </Typography>
        <Chip
          label={es_estable
            ? t('forecast_modelo_estable', 'Modelo Estable')
            : t('forecast_modelo_variable', 'Modelo Variable')
          }
          size="small"
          color={es_estable ? 'success' : 'warning'}
          sx={{ fontWeight: 500 }}
        />
      </Stack>

      {/* Metricas resumidas */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3
        }}
      >
        <Paper
          elevation={0}
          sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 2 }}
        >
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500 }}>
            MAE Promedio
          </Typography>
          <Typography variant="h5" fontWeight={700} color="primary.dark">
            {metricas_agregadas?.mae_mean?.toFixed(2) || '-'}
          </Typography>
          <Typography variant="caption" color="primary.main">
            +/-{metricas_agregadas?.mae_std?.toFixed(2) || '0'}
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{ p: 1.5, bgcolor: 'secondary.50', borderRadius: 2 }}
        >
          <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 500 }}>
            RMSE Promedio
          </Typography>
          <Typography variant="h5" fontWeight={700} color="secondary.dark">
            {metricas_agregadas?.rmse_mean?.toFixed(2) || '-'}
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{ p: 1.5, bgcolor: 'success.50', borderRadius: 2 }}
        >
          <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>
            R2 Promedio
          </Typography>
          <Typography variant="h5" fontWeight={700} color="success.dark">
            {metricas_agregadas?.r2_mean?.toFixed(4) || '-'}
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 2 }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Pasos Exitosos
          </Typography>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            {metricas_agregadas?.n_pasos_exitosos || 0}
          </Typography>
        </Paper>
      </Box>

      {/* Grafico de metricas por paso - Chart.js */}
      {steps && steps.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {t('forecast_backtest_metricas_paso', 'Metricas por Paso de Validacion')}
          </Typography>
          <SPMBar
            labels={chartData.labels}
            datasets={[
              {
                label: 'MAE',
                data: chartData.mae,
                backgroundColor: SPM_COLORS.primary,
              },
              {
                label: 'RMSE',
                data: chartData.rmse,
                backgroundColor: SPM_COLORS.secondary,
              },
            ]}
            height={280}
            options={{
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.raw?.toFixed(2) || '-'}`,
                  },
                },
              },
            }}
          />
        </Box>
      )}

      {/* Tabla de detalle por paso con AG Grid */}
      {rows.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <SPMAgGrid
            rowData={rows}
            columnDefs={columnDefs}
            height={300}
            pagination={true}
            paginationPageSize={5}
            paginationPageSizeSelector={[5, 10, 25]}
            enableQuickFilter={true}
            exportFileName="backtest_resultados"
          />
        </Box>
      )}
    </Paper>
  );
};

export default BacktestResults;
