/**
 * BacktestResults - Resultados de backtesting
 *
 * Muestra métricas y gráficos de validación walk-forward
 */

import React from 'react';
import LazyPlot from './LazyPlot';
import { useI18n } from '../../context/i18n';

const BacktestResults = ({ data, loading = false, className = '' }) => {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className={`p-6 bg-white rounded-lg border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-slate-100 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { metricas_agregadas, steps, es_estable, modelo_tipo } = data;

  // Datos para el gráfico de métricas por paso
  const chartData = [
    {
      x: steps?.map((_, i) => `Paso ${i + 1}`) || [],
      y: steps?.map(s => s.mae) || [],
      type: 'bar',
      name: 'MAE',
      marker: { color: '#3b82f6' }
    },
    {
      x: steps?.map((_, i) => `Paso ${i + 1}`) || [],
      y: steps?.map(s => s.rmse) || [],
      type: 'bar',
      name: 'RMSE',
      marker: { color: '#8b5cf6' }
    }
  ];

  const chartLayout = {
    title: t('forecast_backtest_metricas_paso', 'Métricas por Paso de Validación'),
    barmode: 'group',
    xaxis: { title: '' },
    yaxis: { title: t('forecast_error', 'Error') },
    showlegend: true,
    legend: { orientation: 'h', y: 1.1 },
    margin: { t: 60, r: 20, b: 40, l: 60 },
    height: 300
  };

  return (
    <div className={`p-6 bg-white rounded-lg border ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          {t('forecast_backtest_resultados', 'Resultados de Backtesting')}
        </h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          es_estable
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {es_estable
            ? t('forecast_modelo_estable', 'Modelo Estable')
            : t('forecast_modelo_variable', 'Modelo Variable')
          }
        </span>
      </div>

      {/* Métricas resumidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-600 font-medium">MAE Promedio</p>
          <p className="text-xl font-bold text-blue-700">
            {metricas_agregadas?.mae_mean?.toFixed(2) || '-'}
          </p>
          <p className="text-xs text-blue-500">
            ±{metricas_agregadas?.mae_std?.toFixed(2) || '0'}
          </p>
        </div>

        <div className="p-3 bg-purple-50 rounded-lg">
          <p className="text-xs text-purple-600 font-medium">RMSE Promedio</p>
          <p className="text-xl font-bold text-purple-700">
            {metricas_agregadas?.rmse_mean?.toFixed(2) || '-'}
          </p>
        </div>

        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-green-600 font-medium">R² Promedio</p>
          <p className="text-xl font-bold text-green-700">
            {metricas_agregadas?.r2_mean?.toFixed(4) || '-'}
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600 font-medium">Pasos Exitosos</p>
          <p className="text-xl font-bold text-slate-700">
            {metricas_agregadas?.n_pasos_exitosos || 0}
          </p>
        </div>
      </div>

      {/* Gráfico de métricas por paso */}
      {steps && steps.length > 0 && (
        <LazyPlot
          data={chartData}
          layout={chartLayout}
          config={{ responsive: true, displaylogo: false }}
          style={{ width: '100%' }}
        />
      )}

      {/* Tabla de detalle por paso */}
      {steps && steps.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/30">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Paso</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Fecha Corte</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Train</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Test</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">MAE</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">R²</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(step.fecha_corte).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">{step.n_train}</td>
                  <td className="px-3 py-2 text-right">{step.n_test}</td>
                  <td className="px-3 py-2 text-right font-medium">{step.mae?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-medium">{step.r2?.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BacktestResults;
