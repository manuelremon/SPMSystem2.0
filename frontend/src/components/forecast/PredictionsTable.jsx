/**
 * PredictionsTable - Tabla de predicciones con MUI DataGrid
 *
 * Muestra las predicciones en formato tabular con filtrado y ordenamiento
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
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

const PredictionsTable = ({
  predicciones = [],
  loading = false,
  showIntervalos = true,
}) => {
  const { t } = useI18n();

  // Convertir predicciones a filas con ID
  const rows = useMemo(() => {
    return predicciones.map((p, index) => {
      const fecha = new Date(p.fecha);
      const diaSemana = fecha.toLocaleDateString('es', { weekday: 'short' });
      const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;

      // Calcular tendencia comparando con prediccion anterior
      let tendencia = 'flat';
      if (index > 0) {
        const anterior = predicciones[index - 1].prediccion;
        const diff = p.prediccion - anterior;
        if (diff > 0.5) tendencia = 'up';
        else if (diff < -0.5) tendencia = 'down';
      }

      // Calcular rango (incertidumbre)
      const rango = p.limiteSuperior && p.limiteInferior
        ? p.limiteSuperior - p.limiteInferior
        : 0;

      return {
        id: index,
        fecha: fecha,
        fechaFormateada: fecha.toLocaleDateString('es', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        prediccion: p.prediccion,
        limiteInferior: p.limiteInferior,
        limiteSuperior: p.limiteSuperior,
        diaSemana,
        esFinDeSemana,
        tendencia,
        rango,
        semana: Math.ceil((index + 1) / 7)
      };
    });
  }, [predicciones]);

  // Definir columnas para AG Grid
  const columnDefs = useMemo(() => {
    const cols = [
      {
        field: 'fechaFormateada',
        headerName: t('forecast_fecha', 'Fecha'),
        width: 130,
        cellRenderer: (params) => (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: 'slate.800' }}
            >
              {params.value}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: '10px',
                color: params.data.esFinDeSemana ? 'purple.600' : 'slate.400'
              }}
            >
              {params.data.diaSemana}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'prediccion',
        headerName: t('forecast_prediccion', 'Prediccion'),
        width: 130,
        type: 'numericColumn',
        cellRenderer: (params) => (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="body1"
              sx={{ fontWeight: 700, color: 'primary.main' }}
            >
              {params.value?.toFixed(1) || '-'}
            </Typography>
            {params.data.tendencia === 'up' && (
              <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
            )}
            {params.data.tendencia === 'down' && (
              <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
            )}
            {params.data.tendencia === 'flat' && (
              <TrendingFlatIcon sx={{ fontSize: 16, color: 'grey.400' }} />
            )}
          </Stack>
        ),
      },
    ];

    if (showIntervalos) {
      cols.push(
        {
          field: 'limiteInferior',
          headerName: t('forecast_minimo', 'Min'),
          width: 90,
          type: 'numericColumn',
          cellRenderer: (params) => (
            <Typography
              variant="body2"
              sx={{ color: 'error.main', fontWeight: 500 }}
            >
              {params.value?.toFixed(1) || '-'}
            </Typography>
          ),
        },
        {
          field: 'limiteSuperior',
          headerName: t('forecast_maximo', 'Max'),
          width: 90,
          type: 'numericColumn',
          cellRenderer: (params) => (
            <Typography
              variant="body2"
              sx={{ color: 'success.main', fontWeight: 500 }}
            >
              {params.value?.toFixed(1) || '-'}
            </Typography>
          ),
        },
        {
          field: 'rango',
          headerName: 'Rango',
          width: 100,
          type: 'numericColumn',
          cellRenderer: (params) => {
            const rango = params.value || 0;
            const chipColor = rango < 1 ? 'success' : rango < 2 ? 'warning' : 'error';
            return (
              <Chip
                label={`±${(rango / 2).toFixed(1)}`}
                size="small"
                color={chipColor}
                sx={{ fontSize: '0.75rem', fontWeight: 500 }}
              />
            );
          },
        }
      );
    }

    cols.push({
      field: 'semana',
      headerName: 'Sem',
      width: 70,
      cellRenderer: (params) => (
        <Chip
          label={`S${params.value}`}
          size="small"
          variant="outlined"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 500,
            bgcolor: 'grey.100',
            color: 'grey.600',
            borderRadius: '16px'
          }}
        />
      ),
    });

    return cols;
  }, [showIntervalos, t]);

  // Calcular resumen
  const resumen = useMemo(() => {
    if (!predicciones.length) return null;
    const total = predicciones.reduce((sum, p) => sum + (p.prediccion || 0), 0);
    const promedio = total / predicciones.length;
    const maximo = Math.max(...predicciones.map(p => p.prediccion || 0));
    return { total, promedio, maximo };
  }, [predicciones]);

  if (loading) {
    return (
      <Paper sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
        <Skeleton variant="text" width={128} height={24} sx={{ mb: 2 }} />
        <Stack spacing={1}>
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} variant="rounded" height={40} />
          ))}
        </Stack>
      </Paper>
    );
  }

  if (!predicciones || predicciones.length === 0) {
    return (
      <Paper
        sx={{
          p: 3,
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          textAlign: 'center'
        }}
      >
        <Typography color="text.secondary">
          {t('forecast_sin_predicciones', 'No hay predicciones disponibles')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: 'grey.200',
        overflow: 'hidden'
      }}
    >
      {/* Header mejorado */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          background: 'linear-gradient(to right, #f8fafc, #eff6ff)'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle1" fontWeight={600} color="text.primary">
              {t('forecast_tabla_predicciones', 'Predicciones Detalladas')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {predicciones.length} dias ({Math.ceil(predicciones.length / 7)} semanas)
            </Typography>
          </Box>
          {/* Mini resumen en header */}
          {resumen && (
            <Stack direction="row" spacing={2}>
              <Paper
                variant="outlined"
                sx={{ px: 1.5, py: 0.5, textAlign: 'center', borderRadius: 2 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Promedio
                </Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {resumen.promedio.toFixed(1)}
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{ px: 1.5, py: 0.5, textAlign: 'center', borderRadius: 2 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Maximo
                </Typography>
                <Typography variant="body2" fontWeight={700} color="success.main">
                  {resumen.maximo.toFixed(1)}
                </Typography>
              </Paper>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* AG Grid */}
      <SPMAgGrid
        rowData={rows}
        columnDefs={columnDefs}
        height={420}
        pagination={true}
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 25, 50]}
        enableQuickFilter={true}
        exportFileName="predicciones_pronostico"
      />

      {/* Resumen detallado */}
      {resumen && (
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            background: 'linear-gradient(to right, #f8fafc, #f0fdf4)'
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 2
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'primary.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: 'primary.main' }}
                >
                  S
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Periodo
                </Typography>
                <Typography variant="body2" fontWeight={700} color="text.primary">
                  {resumen.total.toFixed(0)} uds
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'secondary.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: 'secondary.main' }}
                >
                  u
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Promedio/Dia
                </Typography>
                <Typography variant="body2" fontWeight={700} color="text.primary">
                  {resumen.promedio.toFixed(1)} uds
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'success.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Pico Maximo
                </Typography>
                <Typography variant="body2" fontWeight={700} color="text.primary">
                  {resumen.maximo.toFixed(1)} uds
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'warning.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: 'warning.main' }}
                >
                  7d
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Prom/Semana
                </Typography>
                <Typography variant="body2" fontWeight={700} color="text.primary">
                  {(resumen.promedio * 7).toFixed(0)} uds
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default PredictionsTable;
