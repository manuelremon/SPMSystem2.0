/**
 * ForecastChart - Gráfico de predicción de demanda
 *
 * Muestra histórico + predicción con intervalos de confianza
 */

import React, { useMemo, useState, useEffect } from 'react';
import LazyPlot from './LazyPlot';
import { useI18n } from '../../context/i18n';

// Hook para detectar dark mode
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

const ForecastChart = ({
  historico = [],
  predicciones = [],
  titulo = '',
  height = 400,
  showLegend = true,
  colorHistorico = '#3b82f6',
  colorPrediccion = '#10b981',
  colorIntervalo = 'rgba(16, 185, 129, 0.2)'
}) => {
  const { t } = useI18n();
  const isDarkMode = useDarkMode();

  // Colores adaptativos para dark mode
  const chartColors = useMemo(() => ({
    grid: isDarkMode ? '#334155' : '#e5e7eb',        // slate-700 vs gray-200
    text: isDarkMode ? '#94a3b8' : '#64748b',        // slate-400 vs slate-500
    background: isDarkMode ? 'transparent' : 'white',
    divider: isDarkMode ? '#475569' : '#9ca3af',    // slate-600 vs gray-400
  }), [isDarkMode]);

  const data = useMemo(() => {
    const traces = [];

    // Trace del histórico
    if (historico.length > 0) {
      traces.push({
        x: historico.map(h => h.fecha),
        y: historico.map(h => h.cantidad),
        type: 'scatter',
        mode: 'lines+markers',
        name: t('forecast_historico', 'Histórico'),
        line: { color: colorHistorico, width: 2 },
        marker: { size: 4 }
      });
    }

    // Trace de predicciones
    if (predicciones.length > 0) {
      // Línea principal de predicción
      traces.push({
        x: predicciones.map(p => p.fecha),
        y: predicciones.map(p => p.prediccion),
        type: 'scatter',
        mode: 'lines+markers',
        name: t('forecast_prediccion', 'Predicción'),
        line: { color: colorPrediccion, width: 2, dash: 'dash' },
        marker: { size: 4 }
      });

      // Intervalo de confianza (si existe)
      const tieneIntervalo = predicciones.some(p => p.limiteInferior !== undefined);
      if (tieneIntervalo) {
        // Banda superior
        traces.push({
          x: predicciones.map(p => p.fecha),
          y: predicciones.map(p => p.limiteSuperior || p.prediccion),
          type: 'scatter',
          mode: 'lines',
          name: t('forecast_limite_superior', 'Límite Superior'),
          line: { color: 'transparent' },
          showlegend: false
        });

        // Banda inferior con fill
        traces.push({
          x: predicciones.map(p => p.fecha),
          y: predicciones.map(p => p.limiteInferior || p.prediccion),
          type: 'scatter',
          mode: 'lines',
          name: t('forecast_intervalo', 'Intervalo 95%'),
          line: { color: 'transparent' },
          fill: 'tonexty',
          fillcolor: colorIntervalo
        });
      }
    }

    return traces;
  }, [historico, predicciones, colorHistorico, colorPrediccion, colorIntervalo, t]);

  const layout = useMemo(() => ({
    title: {
      text: titulo || t('forecast_grafico_titulo', 'Pronóstico de Demanda'),
      font: { size: 16, color: chartColors.text }
    },
    xaxis: {
      title: { text: t('forecast_fecha', 'Fecha'), font: { color: chartColors.text } },
      tickformat: '%Y-%m-%d',
      gridcolor: chartColors.grid,
      tickfont: { color: chartColors.text }
    },
    yaxis: {
      title: { text: t('forecast_cantidad', 'Cantidad'), font: { color: chartColors.text } },
      gridcolor: chartColors.grid,
      tickfont: { color: chartColors.text }
    },
    showlegend: showLegend,
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.02,
      xanchor: 'right',
      x: 1,
      font: { color: chartColors.text }
    },
    margin: { t: 60, r: 20, b: 60, l: 60 },
    hovermode: 'x unified',
    plot_bgcolor: chartColors.background,
    paper_bgcolor: chartColors.background,
    shapes: historico.length > 0 && predicciones.length > 0 ? [{
      type: 'line',
      x0: historico[historico.length - 1]?.fecha,
      x1: historico[historico.length - 1]?.fecha,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: chartColors.divider, width: 1, dash: 'dot' }
    }] : []
  }), [titulo, showLegend, historico, predicciones, t, chartColors]);

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false,
    locale: 'es'
  };

  if (historico.length === 0 && predicciones.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600"
        style={{ height }}
      >
        <p className="text-slate-500 dark:text-slate-400">{t('forecast_sin_datos', 'Sin datos para mostrar')}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <LazyPlot
        data={data}
        layout={layout}
        config={config}
        style={{ width: '100%', height }}
        useResizeHandler
      />
    </div>
  );
};

export default ForecastChart;
