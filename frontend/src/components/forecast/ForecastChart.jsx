/**
 * ForecastChart - Gráfico de predicción de demanda
 *
 * Muestra histórico + predicción con intervalos de confianza
 */

import React, { useMemo } from 'react';
import LazyPlot from './LazyPlot';
import { useI18n } from '../../context/i18n';

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
      font: { size: 16 }
    },
    xaxis: {
      title: t('forecast_fecha', 'Fecha'),
      tickformat: '%Y-%m-%d',
      gridcolor: '#e5e7eb'
    },
    yaxis: {
      title: t('forecast_cantidad', 'Cantidad'),
      gridcolor: '#e5e7eb'
    },
    showlegend: showLegend,
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.02,
      xanchor: 'right',
      x: 1
    },
    margin: { t: 60, r: 20, b: 60, l: 60 },
    hovermode: 'x unified',
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    shapes: historico.length > 0 && predicciones.length > 0 ? [{
      type: 'line',
      x0: historico[historico.length - 1]?.fecha,
      x1: historico[historico.length - 1]?.fecha,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: '#9ca3af', width: 1, dash: 'dot' }
    }] : []
  }), [titulo, showLegend, historico, predicciones, t]);

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
        className="flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300"
        style={{ height }}
      >
        <p className="text-slate-500">{t('forecast_sin_datos', 'Sin datos para mostrar')}</p>
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
