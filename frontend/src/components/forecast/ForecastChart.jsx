/**
 * ForecastChart - Grafico de prediccion de demanda con Chart.js
 *
 * Muestra historico + prediccion con intervalos de confianza
 * Navigator bar para controlar el rango visible del eje X
 * Toggle de zoom para ver detalle de predicciones
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { SPMLine } from '../ui/SPMChartJS';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useI18n } from '../../context/i18n';

// Paleta de colores — CSS variables del design system
const COLORS = {
  historico: 'var(--fg-muted)',         // contexto gris azulado
  prediccion: 'var(--indigo)',          // protagonista
  intervalo: 'var(--info-bg)',          // Indigo transparente
  grid: 'var(--border)',                // grilla
  navigator: {
    background: 'var(--bg)',
    selection: 'var(--info-bg)',
    border: 'var(--info)',
    handle: 'var(--info)',
    line: 'var(--fg-subtle)',
  }
};

// Colores para modo simulacion (Cold Start)
const COLORS_SIMULATION = {
  prediccion: 'var(--warning-light)',   // Amber distintivo
  intervalo: 'var(--warning-bg)',       // Amber transparente
  safetyStock: 'var(--danger-light)',   // safety stock
  navigator: {
    background: 'var(--warning-bg)',
    selection: 'var(--warning-bg)',
    border: 'var(--warning-light)',
    handle: 'var(--warning-light)',
    line: 'var(--warning)',
  }
};

/**
 * MiniChart - Mini grafico de area simple usando SVG
 * Alternativa ligera para el navigator
 */
const MiniChart = ({ data, color, height = 40 }) => {
  const points = useMemo(() => {
    if (!data || data.length === 0) return '';

    const values = data.map(d => typeof d === 'number' ? d : (d?.value ?? 0));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const pointsArray = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    });

    return pointsArray.join(' ');
  }, [data, height]);

  const areaPath = useMemo(() => {
    if (!data || data.length === 0) return '';

    const values = data.map(d => typeof d === 'number' ? d : (d?.value ?? 0));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    let path = `M 0,${height}`;
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      path += ` L ${x},${y}`;
    });
    path += ` L 100,${height} Z`;

    return path;
  }, [data, height]);

  if (!points) return null;

  return (
    <Box
      component="svg"
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      sx={{ width: '100%', height: '100%' }}
    >
      {/* Linea base de referencia (visible incluso con datos planos) */}
      <line
        x1="0" y1={height / 2}
        x2="100" y2={height / 2}
        stroke={color}
        strokeWidth="0.5"
        strokeDasharray="2 2"
        opacity="0.3"
      />
      <path
        d={areaPath}
        fill={color}
        fillOpacity="0.3"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </Box>
  );
};

/**
 * TimeRangeNavigator - Barra de navegacion para seleccionar rango de tiempo
 * Similar a los navegadores de graficos financieros
 */
const TimeRangeNavigator = ({
  data,
  visibleRange,
  onRangeChange,
  simulationMode = false,
  dateLabels = [],
}) => {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null); // 'left' | 'right' | 'middle' | null
  const [dragStart, setDragStart] = useState(null);

  const navColors = simulationMode ? COLORS_SIMULATION.navigator : COLORS.navigator;

  // Calcular posiciones de los handles basadas en el rango visible
  const totalPoints = data.length;

  // Proteccion contra division por cero
  if (totalPoints === 0) return null;

  const leftPercent = (visibleRange[0] / totalPoints) * 100;
  const rightPercent = (visibleRange[1] / totalPoints) * 100;
  const widthPercent = Math.max(rightPercent - leftPercent, 1);

  // Formatear etiquetas de fecha para el navegador
  const startLabel = dateLabels[visibleRange[0]] || '';
  const endLabel = dateLabels[Math.min(visibleRange[1] - 1, dateLabels.length - 1)] || '';

  const handleMouseDown = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
    setDragStart({
      x: e.clientX,
      range: [...visibleRange],
    });
  }, [visibleRange]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const deltaX = e.clientX - dragStart.x;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const deltaPoints = Math.round((deltaPercent / 100) * totalPoints);

    let newRange = [...dragStart.range];
    const minRangeSize = Math.max(5, Math.floor(totalPoints * 0.05)); // Minimo 5% o 5 puntos

    if (isDragging === 'left') {
      const newStart = Math.max(0, Math.min(dragStart.range[0] + deltaPoints, dragStart.range[1] - minRangeSize));
      newRange = [newStart, dragStart.range[1]];
    } else if (isDragging === 'right') {
      const newEnd = Math.min(totalPoints, Math.max(dragStart.range[1] + deltaPoints, dragStart.range[0] + minRangeSize));
      newRange = [dragStart.range[0], newEnd];
    } else if (isDragging === 'middle') {
      const rangeSize = dragStart.range[1] - dragStart.range[0];
      let newStart = dragStart.range[0] + deltaPoints;
      let newEnd = dragStart.range[1] + deltaPoints;

      // Limitar dentro de los bounds
      if (newStart < 0) {
        newStart = 0;
        newEnd = rangeSize;
      }
      if (newEnd > totalPoints) {
        newEnd = totalPoints;
        newStart = totalPoints - rangeSize;
      }

      newRange = [newStart, newEnd];
    }

    onRangeChange(newRange);
  }, [isDragging, dragStart, totalPoints, onRangeChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    setDragStart(null);
  }, []);

  // Agregar event listeners globales durante el drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (data.length < 2) return null;

  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
      {/* Labels de rango */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, px: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'text.secondary' }}>
          {startLabel}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: 'var(--text-xs)', color: 'text.secondary' }}>
          {t('forecast_navigator_rango', 'Rango visible')}: {visibleRange[1] - visibleRange[0]} {t('common_dias', 'dias')}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'text.secondary' }}>
          {endLabel}
        </Typography>
      </Stack>

      {/* Navigator container */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          height: 44,
          overflow: 'hidden',
          border: 1,
          borderColor: 'grey.200',
          bgcolor: navColors.background
        }}
      >
        {/* Mini chart de fondo */}
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <MiniChart
            data={data}
            color={navColors.line}
            height={44}
          />
        </Box>

        {/* Areas grises (no seleccionadas) - mas oscuras con patron */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            pointerEvents: 'none',
            width: `${leftPercent}%`,
            bgcolor: 'rgba(71, 85, 105, 0.4)',
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 6px)'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            pointerEvents: 'none',
            width: `${100 - rightPercent}%`,
            bgcolor: 'rgba(71, 85, 105, 0.4)',
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 6px)'
          }}
        />

        {/* Area de seleccion */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            cursor: 'move',
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            bgcolor: navColors.selection,
            borderTop: `2px solid ${navColors.border}`,
            borderBottom: `2px solid ${navColors.border}`,
          }}
          onMouseDown={(e) => handleMouseDown(e, 'middle')}
        />

        {/* Handle izquierdo - mas grande con grip lines */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 14,
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            left: `calc(${leftPercent}% - 7px)`,
            '&:hover > div': { height: 34 }
          }}
          onMouseDown={(e) => handleMouseDown(e, 'left')}
        >
          <Box
            sx={{
              width: 8,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
              transition: 'height 0.2s',
              boxShadow: 1,
              border: '1px solid rgba(255,255,255,0.5)',
              bgcolor: navColors.handle
            }}
          >
            <Box sx={{ width: 4, height: 1, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
            <Box sx={{ width: 4, height: 1, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
            <Box sx={{ width: 4, height: 1, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
          </Box>
        </Box>

        {/* Handle derecho - mas grande con grip lines */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 14,
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            left: `calc(${rightPercent}% - 7px)`,
            '&:hover > div': { height: 34 }
          }}
          onMouseDown={(e) => handleMouseDown(e, 'right')}
        >
          <Box
            sx={{
              width: 8,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
              transition: 'height 0.2s',
              boxShadow: 1,
              border: '1px solid rgba(255,255,255,0.5)',
              bgcolor: navColors.handle
            }}
          >
            <Box sx={{ width: 4, height: 1, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
            <Box sx={{ width: 4, height: 1, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
            <Box sx={{ width: 4, height: 1, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
          </Box>
        </Box>
      </Box>

      {/* Quick range buttons */}
      <Stack direction="row" justifyContent="center" spacing={0.5} sx={{ mt: 1 }}>
        <Button
          size="small"
          variant={visibleRange[0] === 0 && visibleRange[1] === totalPoints ? 'contained' : 'text'}
          color={visibleRange[0] === 0 && visibleRange[1] === totalPoints ? 'primary' : 'inherit'}
          onClick={() => onRangeChange([0, totalPoints])}
          sx={{
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            minWidth: 'auto',
            px: 1.5,
            py: 0.5,
            textTransform: 'none',
            color: visibleRange[0] === 0 && visibleRange[1] === totalPoints ? 'primary.contrastText' : 'text.secondary'
          }}
        >
          {t('forecast_nav_todo', 'Todo')}
        </Button>
        {totalPoints > 30 && (
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={() => onRangeChange([Math.max(0, totalPoints - 30), totalPoints])}
            sx={{ fontSize: 'var(--text-xs)', fontWeight: 500, minWidth: 'auto', px: 1.5, py: 0.5, textTransform: 'none', color: 'text.secondary' }}
          >
            30D
          </Button>
        )}
        {totalPoints > 90 && (
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={() => onRangeChange([Math.max(0, totalPoints - 90), totalPoints])}
            sx={{ fontSize: 'var(--text-xs)', fontWeight: 500, minWidth: 'auto', px: 1.5, py: 0.5, textTransform: 'none', color: 'text.secondary' }}
          >
            90D
          </Button>
        )}
        {totalPoints > 180 && (
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={() => onRangeChange([Math.max(0, totalPoints - 180), totalPoints])}
            sx={{ fontSize: 'var(--text-xs)', fontWeight: 500, minWidth: 'auto', px: 1.5, py: 0.5, textTransform: 'none', color: 'text.secondary' }}
          >
            6M
          </Button>
        )}
      </Stack>
    </Box>
  );
};

const ForecastChart = ({
  historico = [],
  predicciones = [],
  titulo = '',
  height = 400,
  showLegend = true,
  showNavigator = true, // Nuevo: mostrar/ocultar navegador
  maxHistoricoDias = 90, // Limitar historico visible para mejor legibilidad
  simulationMode = false, // Modo simulacion para cold start
  safetyStock = null, // Valor de safety stock (solo en simulacion)
}) => {
  const { t } = useI18n();

  // Seleccionar paleta de colores segun modo
  const activeColors = simulationMode ? {
    prediccion: COLORS_SIMULATION.prediccion,
    intervalo: COLORS_SIMULATION.intervalo,
  } : {
    prediccion: COLORS.prediccion,
    intervalo: COLORS.intervalo,
  };

  // Estado para toggle de zoom en prediccion
  const [zoomPrediccion, setZoomPrediccion] = useState(false);

  // Estado del rango visible (para el navigator) - inicializado como null hasta tener datos
  const [visibleRange, setVisibleRange] = useState(null);

  // Preparar TODOS los datos (sin limitacion para el navigator)
  const fullData = useMemo(() => {
    const allDates = [];
    const allValues = [];
    const labels = [];

    // Procesar historico completo
    historico.forEach(h => {
      const fecha = new Date(h.fecha);
      allDates.push(fecha);
      allValues.push({ value: h.cantidad, type: 'historico' });
      labels.push(fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }));
    });

    // Procesar predicciones
    predicciones.forEach(p => {
      const fecha = new Date(p.fecha);
      allDates.push(fecha);
      allValues.push({ value: p.prediccion, type: 'prediccion' });
      labels.push(fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }));
    });

    return { dates: allDates, values: allValues, labels };
  }, [historico, predicciones]);

  // Actualizar rango cuando cambian los datos
  useEffect(() => {
    const total = fullData.dates.length;
    if (total > 0) {
      const defaultStart = Math.max(0, historico.length - maxHistoricoDias);
      setVisibleRange([defaultStart, total]);
    }
  }, [fullData.dates.length, historico.length, maxHistoricoDias]);

  // Rango efectivo para usar en el componente
  const effectiveRange = visibleRange || [0, fullData.dates.length];

  // Preparar datos VISIBLES para Chart.js (filtrados por el rango)
  const { labels, datasets, outlierIndices } = useMemo(() => {
    const [startIdx, endIdx] = effectiveRange;

    // Filtrar datos segun el rango visible
    const visibleValues = fullData.values.slice(startIdx, endIdx);
    const visibleLabels = fullData.labels.slice(startIdx, endIdx);

    const historicoValues = [];
    const prediccionValues = [];
    const limiteSuperior = [];
    const limiteInferior = [];

    visibleValues.forEach((v, i) => {
      if (v.type === 'historico') {
        historicoValues.push(v.value);
        prediccionValues.push(null);
        limiteSuperior.push(null);
        limiteInferior.push(null);
      } else {
        historicoValues.push(null);
        prediccionValues.push(v.value);
        // Buscar los limites en las predicciones originales
        const globalIdx = startIdx + i;
        const predIdx = globalIdx - historico.length;
        if (predIdx >= 0 && predIdx < predicciones.length) {
          const pred = predicciones[predIdx];
          limiteSuperior.push(pred.limiteSuperior || pred.prediccion);
          limiteInferior.push(pred.limiteInferior || pred.prediccion);
        } else {
          limiteSuperior.push(v.value);
          limiteInferior.push(v.value);
        }
      }
    });

    // Calcular outliers usando metodo IQR (solo para valores historicos visibles)
    let outliers = [];
    const visibleHistorico = visibleValues.filter(v => v.type === 'historico');
    if (visibleHistorico.length >= 10) {
      const sortedValues = [...visibleHistorico].map(h => h.value).sort((a, b) => a - b);
      const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
      const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
      const iqr = q3 - q1;
      const outlierThreshold = q3 + 1.5 * iqr;
      outliers = visibleValues
        .map((v, i) => v.type === 'historico' && v.value > outlierThreshold ? i : null)
        .filter(i => i !== null);
    }

    // Construir datasets para Chart.js
    const chartDatasets = [];

    // Contar dias de historico visibles
    const visibleHistoricoDays = visibleValues.filter(v => v.type === 'historico').length;

    // Dataset de historico
    if (visibleHistoricoDays > 0) {
      chartDatasets.push({
        label: t('forecast_historico', `Historico (${visibleHistoricoDays}d)`),
        data: historicoValues,
        borderColor: COLORS.historico,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: false,
      });
    }

    // Contar dias de prediccion visibles
    const visiblePrediccionDays = visibleValues.filter(v => v.type === 'prediccion').length;

    // Dataset de prediccion
    if (visiblePrediccionDays > 0) {
      chartDatasets.push({
        label: simulationMode
          ? t('forecast_valor_simulado', 'Valor Simulado')
          : t('forecast_prediccion', 'Prediccion'),
        data: prediccionValues,
        borderColor: activeColors.prediccion,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderDash: simulationMode ? [8, 4] : [],
        spanGaps: false,
      });

      // Intervalo de confianza (area sombreada)
      const tieneIntervalo = predicciones.some(p => p.limiteInferior !== undefined);
      if (tieneIntervalo) {
        // Limite superior (linea con area hacia abajo)
        chartDatasets.push({
          label: t('forecast_limite_superior', 'Limite Superior'),
          data: limiteSuperior,
          borderColor: 'transparent',
          backgroundColor: activeColors.intervalo,
          borderWidth: 0,
          tension: 0.3,
          pointRadius: 0,
          fill: '+1', // Fill hacia el siguiente dataset (limite inferior)
          spanGaps: false,
        });

        // Limite inferior
        chartDatasets.push({
          label: t('forecast_limite_inferior', 'Limite Inferior'),
          data: limiteInferior,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          borderWidth: 0,
          tension: 0.3,
          pointRadius: 0,
          fill: false,
          spanGaps: false,
        });
      }
    }

    return {
      labels: visibleLabels,
      datasets: chartDatasets,
      outlierIndices: outliers,
    };
  }, [effectiveRange, fullData, historico, predicciones, t, simulationMode, activeColors]);

  // Calcular rango Y dinamico para zoom
  const yAxisConfig = useMemo(() => {
    if (zoomPrediccion && predicciones.length > 0) {
      const maxPred = Math.max(...predicciones.map(p => p.limiteSuperior || p.prediccion));
      const minPred = Math.min(...predicciones.map(p => p.limiteInferior || p.prediccion));
      const padding = (maxPred - minPred) * 0.2 || maxPred * 0.2;
      return {
        min: Math.max(0, minPred - padding),
        max: maxPred + padding
      };
    }
    return { beginAtZero: true }; // Escala automatica
  }, [zoomPrediccion, predicciones]);

  // Handler para cambios en el rango del navigator
  const handleRangeChange = useCallback((newRange) => {
    setVisibleRange(newRange);
  }, []);

  // Opciones de Chart.js
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: showLegend ? {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { size: 12 },
          // Filtrar etiquetas de intervalos de la leyenda
          filter: (item) => {
            return !item.text.includes('Limite');
          },
        },
      } : { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 4,
        displayColors: true,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return null;
            const label = context.dataset.label || '';
            // Ocultar tooltips de limites
            if (label.includes('Limite')) return null;
            return `${label}: ${value.toFixed(1)} unidades`;
          },
        },
        filter: (tooltipItem) => {
          // Filtrar items con valor null
          return tooltipItem.parsed.y !== null;
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: COLORS.grid,
          drawBorder: false,
        },
        ticks: {
          font: { size: 11 },
          color: 'var(--neutral)',
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        ...yAxisConfig,
        grid: {
          color: COLORS.grid,
          drawBorder: false,
        },
        ticks: {
          font: { size: 11 },
          color: 'var(--neutral)',
        },
      },
    },
  }), [showLegend, yAxisConfig]);

  // Estado vacio
  if (historico.length === 0 && predicciones.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.50',
          border: '1px dashed',
          borderColor: 'grey.300',
          height
        }}
      >
        <Typography color="text.secondary">
          {t('forecast_sin_datos', 'Sin datos para mostrar')}
        </Typography>
      </Box>
    );
  }

  // Decidir si mostrar el navigator (solo si hay suficientes datos)
  const shouldShowNavigator = showNavigator && fullData.dates.length > 30;

  return (
    <Paper elevation={0} sx={{ width: '100%', bgcolor: 'white', p: 2 }}>
      {/* Header con titulo y controles */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {titulo && (
            <Typography variant="h6" fontWeight={600} color="text.primary">
              {titulo || t('forecast_grafico_titulo', 'Pronostico de Demanda')}
            </Typography>
          )}
          {simulationMode && (
            <Chip
              icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
              label={t('forecast_modo_simulacion', 'Simulacion')}
              size="small"
              sx={{
                bgcolor: 'warning.50',
                color: 'warning.dark',
                border: 1,
                borderColor: 'warning.200',
                '& .MuiChip-icon': { color: 'warning.main' }
              }}
            />
          )}
        </Stack>

        {/* Toggle de zoom - solo si hay predicciones */}
        {predicciones.length > 0 && (
          <Button
            size="small"
            variant={zoomPrediccion ? 'contained' : 'outlined'}
            color={zoomPrediccion ? 'primary' : 'inherit'}
            onClick={() => setZoomPrediccion(!zoomPrediccion)}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'none',
              px: 1.5,
              py: 0.75,
              borderColor: zoomPrediccion ? undefined : 'grey.200',
              color: zoomPrediccion ? 'primary.contrastText' : 'text.secondary'
            }}
            title={zoomPrediccion
              ? t('forecast_zoom_ver_todo', 'Ver escala completa')
              : t('forecast_zoom_prediccion', 'Zoom en prediccion')
            }
          >
            {zoomPrediccion
              ? t('forecast_ver_todo', 'Ver Todo')
              : t('forecast_zoom', 'Zoom Prediccion')
            }
          </Button>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {simulationMode ? (
          <>
            {t('forecast_simulation_hint', 'Datos generados sinteticamente basados en parametros ingresados')}
            {safetyStock !== null && (
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'warning.main', fontWeight: 500 }}>
                - {t('forecast_safety_stock', 'Stock de Seguridad')}: {safetyStock.toFixed(1)} unid.
              </Typography>
            )}
          </>
        ) : (
          <>
            {t('forecast_hint', 'Usa el navegador inferior para ajustar el rango de fechas visible')}
            {outlierIndices.length > 0 && (
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'warning.main' }}>
                - {outlierIndices.length} {t('forecast_outliers', 'valores atipicos detectados')}
              </Typography>
            )}
          </>
        )}
      </Typography>

      {/* Grafico principal con Chart.js */}
      <SPMLine
        labels={labels}
        datasets={datasets}
        options={chartOptions}
        height={shouldShowNavigator ? height - 80 : height}
      />

      {/* Navigator / Time Range Selector */}
      {shouldShowNavigator && (
        <TimeRangeNavigator
          data={fullData.values}
          visibleRange={effectiveRange}
          onRangeChange={handleRangeChange}
          simulationMode={simulationMode}
          dateLabels={fullData.labels}
        />
      )}
    </Paper>
  );
};

export default ForecastChart;
