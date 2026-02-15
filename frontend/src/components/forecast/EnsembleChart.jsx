/**
 * EnsembleChart - Visualización de predicciones ensemble
 *
 * Muestra predicciones de múltiples modelos combinadas con weighted averaging.
 * Incluye gráfico de líneas con predicciones individuales y tabla de pesos/métricas.
 */

import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { SPMLine } from '../ui/SPMChartJS';
import { useI18n } from '../../context/i18n';

// Paleta de colores para modelos individuales
const MODEL_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
];

// Color para ensemble (destacado)
const ENSEMBLE_COLOR = '#6366f1'; // indigo-500
const ENSEMBLE_INTERVAL_COLOR = 'rgba(99, 102, 241, 0.15)'; // indigo with transparency

/**
 * EnsembleChart Component
 *
 * @param {Object} props
 * @param {Object} props.ensembleData - Datos del ensemble {predicciones, metricas, pesos, n_modelos}
 * @param {Array} props.individualData - Array de {modelo, predicciones, metricas, peso}
 * @param {Object} props.weights - Pesos de cada modelo {nombre_modelo: peso}
 * @param {Object} props.metricas - Métricas del ensemble {mae, rmse, r2, mape}
 * @param {number} props.height - Altura del gráfico (default 400)
 * @param {boolean} props.showTable - Mostrar tabla de pesos/métricas (default true)
 */
const EnsembleChart = ({
  ensembleData,
  individualData = [],
  weights = {},
  metricas = {},
  height = 400,
  showTable = true,
}) => {
  const { t } = useI18n();

  // Preparar datos para Chart.js
  const { labels, datasets } = useMemo(() => {
    if (!ensembleData || !ensembleData.predicciones || ensembleData.predicciones.length === 0) {
      return { labels: [], datasets: [] };
    }

    const ensemblePredicciones = ensembleData.predicciones;

    // Labels (fechas)
    const chartLabels = ensemblePredicciones.map(p => {
      const fecha = new Date(p.fecha);
      return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    });

    // Datasets
    const chartDatasets = [];

    // 1. Predicciones individuales (semi-transparentes)
    individualData.forEach((item, idx) => {
      const color = MODEL_COLORS[idx % MODEL_COLORS.length];
      const predicciones = item.predicciones || [];

      chartDatasets.push({
        label: item.modelo,
        data: predicciones.map(p => p.prediccion || 0),
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 2],
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 3,
        spanGaps: false,
        opacity: 0.6,
      });
    });

    // 2. Intervalo de confianza del ensemble (área sombreada)
    const tieneIntervalo = ensemblePredicciones.some(p =>
      p.limite_superior !== undefined || p.limiteSuperior !== undefined
    );

    if (tieneIntervalo) {
      // Límite superior
      chartDatasets.push({
        label: t('forecast_ensemble_intervalo', 'Intervalo de Confianza'),
        data: ensemblePredicciones.map(p => p.limite_superior || p.limiteSuperior || p.prediccion),
        borderColor: 'transparent',
        backgroundColor: ENSEMBLE_INTERVAL_COLOR,
        borderWidth: 0,
        tension: 0.3,
        pointRadius: 0,
        fill: '+1', // Fill hacia el siguiente dataset
        spanGaps: false,
      });

      // Límite inferior
      chartDatasets.push({
        label: 'Límite Inferior',
        data: ensemblePredicciones.map(p => p.limite_inferior || p.limiteInferior || p.prediccion),
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        borderWidth: 0,
        tension: 0.3,
        pointRadius: 0,
        fill: false,
        spanGaps: false,
      });
    }

    // 3. Predicción ensemble (línea principal destacada)
    chartDatasets.push({
      label: t('forecast_ensemble_prediccion', 'Ensemble'),
      data: ensemblePredicciones.map(p => p.prediccion),
      borderColor: ENSEMBLE_COLOR,
      backgroundColor: 'transparent',
      borderWidth: 3,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 5,
      spanGaps: false,
    });

    return {
      labels: chartLabels,
      datasets: chartDatasets,
    };
  }, [ensembleData, individualData, t]);

  // Opciones de Chart.js
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          padding: 12,
          font: { size: 11 },
          // Filtrar intervalos de la leyenda
          filter: (item) => {
            return !item.text.includes('Límite') && !item.text.includes('Intervalo');
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 4,
        displayColors: true,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return null;
            const label = context.dataset.label || '';
            // Ocultar tooltips de límites
            if (label.includes('Límite')) return null;
            return `${label}: ${value.toFixed(2)} unidades`;
          },
        },
        filter: (tooltipItem) => {
          return tooltipItem.parsed.y !== null;
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#e2e8f0',
          drawBorder: false,
        },
        ticks: {
          font: { size: 10 },
          color: '#64748b',
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 15,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#e2e8f0',
          drawBorder: false,
        },
        ticks: {
          font: { size: 10 },
          color: '#64748b',
        },
      },
    },
  }), []);

  // Estado vacío
  if (!ensembleData || !ensembleData.predicciones || ensembleData.predicciones.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.50',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'grey.300',
          height,
        }}
      >
        <Typography color="text.secondary">
          {t('forecast_ensemble_sin_datos', 'Sin datos de ensemble para mostrar')}
        </Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ width: '100%', bgcolor: 'white', borderRadius: 2, p: 2 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h6" fontWeight={600} color="text.primary">
            {t('forecast_ensemble_titulo', 'Predicción Ensemble')}
          </Typography>
          <Chip
            label={`${ensembleData.n_modelos || individualData.length} ${t('forecast_ensemble_modelos', 'modelos')}`}
            size="small"
            sx={{
              bgcolor: 'primary.50',
              color: 'primary.dark',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            MAPE: <strong>{metricas.mape?.toFixed(2) || 'N/A'}%</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            R²: <strong>{metricas.r2?.toFixed(3) || 'N/A'}</strong>
          </Typography>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {t('forecast_ensemble_hint', 'Combinación ponderada de múltiples modelos de pronóstico')}
      </Typography>

      {/* Gráfico */}
      <Box sx={{ height: showTable ? height - 200 : height, mb: showTable ? 2 : 0 }}>
        <SPMLine
          labels={labels}
          datasets={datasets}
          options={chartOptions}
          height={showTable ? height - 200 : height}
        />
      </Box>

      {/* Tabla de pesos y métricas */}
      {showTable && individualData.length > 0 && (
        <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider', pt: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            {t('forecast_ensemble_pesos_metricas', 'Pesos y Métricas de Modelos')}
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {t('forecast_ensemble_modelo', 'Modelo')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {t('forecast_ensemble_peso', 'Peso')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    MAE
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    MAPE (%)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    RMSE
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    R²
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {individualData
                  .sort((a, b) => (b.peso || 0) - (a.peso || 0)) // Ordenar por peso descendente
                  .map((item, idx) => {
                    const color = MODEL_COLORS[idx % MODEL_COLORS.length];
                    const modelMetricas = item.metricas || {};
                    const peso = item.peso || 0;

                    return (
                      <TableRow
                        key={item.modelo}
                        sx={{
                          '&:hover': { bgcolor: 'grey.50' },
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: color,
                              }}
                            />
                            <Typography variant="body2" fontWeight={500}>
                              {item.modelo}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ color: peso > 0.3 ? 'success.main' : 'text.secondary' }}
                          >
                            {(peso * 100).toFixed(1)}%
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {modelMetricas.mae?.toFixed(2) || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {modelMetricas.mape?.toFixed(2) || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {modelMetricas.rmse?.toFixed(2) || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              color:
                                (modelMetricas.r2 || 0) > 0.7
                                  ? 'success.main'
                                  : (modelMetricas.r2 || 0) > 0.4
                                  ? 'warning.main'
                                  : 'error.main',
                            }}
                          >
                            {modelMetricas.r2?.toFixed(3) || 'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {/* Fila del ensemble (resumen) */}
                <TableRow sx={{ bgcolor: 'primary.50' }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color="primary.dark">
                      {t('forecast_ensemble_total', 'Ensemble Total')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700} color="primary.dark">
                      100%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {metricas.mae?.toFixed(2) || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {metricas.mape?.toFixed(2) || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {metricas.rmse?.toFixed(2) || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        color:
                          (metricas.r2 || 0) > 0.7
                            ? 'success.main'
                            : (metricas.r2 || 0) > 0.4
                            ? 'warning.main'
                            : 'error.main',
                      }}
                    >
                      {metricas.r2?.toFixed(3) || 'N/A'}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default EnsembleChart;
