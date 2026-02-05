/**
 * SPMCharts - Componentes de graficos MUI X Charts para SPM
 *
 * Wrapper de MUI X Charts con estilos del sistema SPM
 * Incluye: LineChart, BarChart, PieChart, SparkLineChart, Gauge
 */

import React from 'react';
import {
  LineChart,
  BarChart,
  PieChart,
  SparkLineChart,
  Gauge,
  gaugeClasses,
} from '@mui/x-charts';
import { useI18n } from '../../context/i18n';

// Paleta de colores MUI oficial
export const SPM_COLORS = {
  primary: '#1976d2',      // MUI Blue 700
  secondary: '#9c27b0',    // MUI Purple 500
  success: '#2e7d32',      // MUI Green 800
  warning: '#ed6c02',      // MUI Orange 700
  error: '#d32f2f',        // MUI Red 700
  info: '#0288d1',         // MUI Light Blue 700
  // Colores adicionales para series
  series: [
    '#1976d2', // Blue
    '#2e7d32', // Green
    '#ed6c02', // Orange
    '#9c27b0', // Purple
    '#d32f2f', // Red
    '#0288d1', // Light Blue
    '#ffc107', // Amber
    '#795548', // Brown
  ],
};

// Configuracion base de estilos
const baseChartProps = {
  slotProps: {
    legend: {
      direction: 'row',
      position: { vertical: 'top', horizontal: 'right' },
      padding: 0,
      itemMarkWidth: 10,
      itemMarkHeight: 10,
      markGap: 5,
      itemGap: 15,
    },
  },
};

/**
 * SPMLineChart - Grafico de lineas con estilos SPM
 */
export function SPMLineChart({
  series,
  xAxis,
  yAxis,
  height = 300,
  width,
  showGrid = true,
  showLegend = true,
  colors = SPM_COLORS.series,
  margin,
  ...props
}) {
  return (
    <LineChart
      series={series}
      xAxis={xAxis}
      yAxis={yAxis}
      height={height}
      width={width}
      colors={colors}
      grid={showGrid ? { vertical: true, horizontal: true } : undefined}
      margin={margin || { top: 20, bottom: 30, left: 40, right: 20 }}
      {...baseChartProps}
      slotProps={{
        ...baseChartProps.slotProps,
        legend: showLegend ? baseChartProps.slotProps.legend : { hidden: true },
      }}
      {...props}
    />
  );
}

/**
 * SPMBarChart - Grafico de barras con estilos SPM
 */
export function SPMBarChart({
  series,
  xAxis,
  yAxis,
  height = 300,
  width,
  layout = 'vertical',
  showGrid = true,
  showLegend = true,
  colors = SPM_COLORS.series,
  margin,
  barLabel,
  ...props
}) {
  return (
    <BarChart
      series={series}
      xAxis={xAxis}
      yAxis={yAxis}
      height={height}
      width={width}
      layout={layout}
      colors={colors}
      grid={showGrid ? { vertical: true, horizontal: true } : undefined}
      margin={margin || { top: 20, bottom: 30, left: 40, right: 20 }}
      barLabel={barLabel}
      {...baseChartProps}
      slotProps={{
        ...baseChartProps.slotProps,
        legend: showLegend ? baseChartProps.slotProps.legend : { hidden: true },
      }}
      {...props}
    />
  );
}

/**
 * SPMPieChart - Grafico de pastel con estilos SPM
 */
export function SPMPieChart({
  series,
  height = 300,
  width,
  showLegend = true,
  colors = SPM_COLORS.series,
  ...props
}) {
  return (
    <PieChart
      series={series}
      height={height}
      width={width}
      colors={colors}
      {...baseChartProps}
      slotProps={{
        ...baseChartProps.slotProps,
        legend: showLegend ? baseChartProps.slotProps.legend : { hidden: true },
      }}
      {...props}
    />
  );
}

/**
 * SPMSparkLine - Mini grafico de linea/area
 */
export function SPMSparkLine({
  data,
  height = 50,
  width = 100,
  plotType = 'line',
  showHighlight = true,
  showTooltip = true,
  color = SPM_COLORS.primary,
  area = false,
  ...props
}) {
  return (
    <SparkLineChart
      data={data}
      height={height}
      width={width}
      plotType={plotType}
      showHighlight={showHighlight}
      showTooltip={showTooltip}
      colors={[color]}
      area={area}
      {...props}
    />
  );
}

/**
 * SPMGauge - Indicador tipo velocimetro/medidor con colores dinamicos
 *
 * @param {number} value - Valor actual
 * @param {object} thresholds - Umbrales para colores { warning: 70, danger: 90 }
 * @param {string} color - Color fijo (se ignora si thresholds esta definido)
 */
export function SPMGauge({
  value,
  valueMin = 0,
  valueMax = 100,
  height = 150,
  width = 150,
  startAngle = -110,
  endAngle = 110,
  showText = true,
  color = SPM_COLORS.primary,
  thresholds = null, // { warning: 70, danger: 90 }
  textSize = null, // fontSize personalizado, o null para auto
  ...props
}) {
  // Calcular color dinamico segun umbrales
  const dynamicColor = thresholds
    ? value > thresholds.danger
      ? SPM_COLORS.error
      : value > thresholds.warning
        ? SPM_COLORS.warning
        : SPM_COLORS.success
    : color;

  // Calcular fontSize proporcional al tamaño del gauge
  const minDimension = Math.min(width, height);
  const autoFontSize = Math.max(10, Math.round(minDimension * 0.18));
  const fontSize = textSize || autoFontSize;

  return (
    <Gauge
      value={value}
      valueMin={valueMin}
      valueMax={valueMax}
      height={height}
      width={width}
      startAngle={startAngle}
      endAngle={endAngle}
      text={showText ? ({ value }) => `${value}%` : undefined}
      sx={{
        [`& .${gaugeClasses.valueText}`]: {
          fontSize,
          fontWeight: 'bold',
          fill: dynamicColor,
        },
        [`& .${gaugeClasses.valueArc}`]: {
          fill: dynamicColor,
        },
      }}
      {...props}
    />
  );
}

/**
 * SPMAreaChart - Grafico de area (LineChart con fill)
 */
export function SPMAreaChart({
  series,
  xAxis,
  yAxis,
  height = 300,
  width,
  showGrid = true,
  showLegend = true,
  colors = SPM_COLORS.series,
  margin,
  ...props
}) {
  // Agregar area: true a cada serie
  const areasSeries = series.map(s => ({ ...s, area: true }));

  return (
    <LineChart
      series={areasSeries}
      xAxis={xAxis}
      yAxis={yAxis}
      height={height}
      width={width}
      colors={colors}
      grid={showGrid ? { vertical: true, horizontal: true } : undefined}
      margin={margin || { top: 20, bottom: 30, left: 40, right: 20 }}
      {...baseChartProps}
      slotProps={{
        ...baseChartProps.slotProps,
        legend: showLegend ? baseChartProps.slotProps.legend : { hidden: true },
      }}
      {...props}
    />
  );
}

// Exportar colores para uso externo
export { SPM_COLORS as chartColors };

export default {
  SPMLineChart,
  SPMBarChart,
  SPMPieChart,
  SPMSparkLine,
  SPMGauge,
  SPMAreaChart,
  SPM_COLORS,
};
