/**
 * ModelComparison - Comparación de modelos de forecast
 *
 * Muestra ranking y métricas comparativas de múltiples modelos
 */

import React from 'react';
import LazyPlot from './LazyPlot';
import { useI18n } from '../../context/i18n';
import { Button } from '../ui/Button';

const MODELOS_NOMBRES = {
  random_forest: 'Random Forest',
  gradient_boosting: 'Gradient Boosting',
  linear: 'Regresión Lineal',
  xgboost: 'XGBoost',
  prophet: 'Prophet',
  arima: 'ARIMA'
};

const ModelComparison = ({
  data,
  loading = false,
  onSelectModel,
  className = ''
}) => {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className={`p-6 bg-white rounded-lg border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-48 mb-4"></div>
          <div className="h-64 bg-slate-100 rounded mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { ranking, mejor_modelo, recomendacion } = data;

  // Datos para el gráfico de barras
  const chartData = [
    {
      x: ranking?.map(r => MODELOS_NOMBRES[r.modelo] || r.modelo) || [],
      y: ranking?.map(r => r.mae) || [],
      type: 'bar',
      name: 'MAE',
      marker: {
        color: ranking?.map(r => r.modelo === mejor_modelo ? '#10b981' : '#3b82f6') || []
      },
      text: ranking?.map(r => r.mae?.toFixed(2)) || [],
      textposition: 'outside'
    }
  ];

  const chartLayout = {
    title: t('forecast_comparacion_mae', 'Comparación de MAE por Modelo'),
    xaxis: { title: '' },
    yaxis: { title: 'MAE (Error Absoluto Medio)' },
    margin: { t: 60, r: 20, b: 80, l: 60 },
    height: 300,
    showlegend: false
  };

  // Gráfico radar para múltiples métricas
  const radarData = [{
    type: 'scatterpolar',
    r: ranking?.slice(0, 5).map(r => [
      r.mae ? 100 - Math.min(r.mae, 100) : 0,
      r.rmse ? 100 - Math.min(r.rmse, 100) : 0,
      (r.r2 || 0) * 100,
      100 - (r.mae_std || 0) * 10
    ]).flat() || [],
    theta: ranking?.slice(0, 5).flatMap(r => [
      `${MODELOS_NOMBRES[r.modelo] || r.modelo} - MAE`,
      `${MODELOS_NOMBRES[r.modelo] || r.modelo} - RMSE`,
      `${MODELOS_NOMBRES[r.modelo] || r.modelo} - R²`,
      `${MODELOS_NOMBRES[r.modelo] || r.modelo} - Estabilidad`
    ]) || [],
    fill: 'toself',
    name: 'Modelos'
  }];

  return (
    <div className={`p-6 bg-white rounded-lg border ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          {t('forecast_comparacion_modelos', 'Comparación de Modelos')}
        </h3>
        {mejor_modelo && (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            Mejor: {MODELOS_NOMBRES[mejor_modelo] || mejor_modelo}
          </span>
        )}
      </div>

      {/* Recomendación */}
      {recomendacion && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-700">{recomendacion}</p>
        </div>
      )}

      {/* Gráfico de barras */}
      {ranking && ranking.length > 0 && (
        <LazyPlot
          data={chartData}
          layout={chartLayout}
          config={{ responsive: true, displaylogo: false }}
          style={{ width: '100%' }}
        />
      )}

      {/* Tabla de ranking */}
      {ranking && ranking.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/30">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">#</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Modelo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">MAE</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">RMSE</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">R²</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Acción</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr
                  key={r.modelo}
                  className={`border-b border-slate-100 ${
                    r.modelo === mejor_modelo ? 'bg-green-50' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : r.posicion}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {MODELOS_NOMBRES[r.modelo] || r.modelo}
                    {r.modelo === mejor_modelo && (
                      <span className="ml-2 text-xs text-green-600">(Recomendado)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.mae?.toFixed(2)}
                    {r.mae_std && (
                      <span className="text-slate-400 text-xs ml-1">
                        ±{r.mae_std.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{r.rmse?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{r.r2?.toFixed(4)}</td>
                  <td className="px-3 py-2 text-center">
                    {onSelectModel && (
                      <Button
                        onClick={() => onSelectModel(r.modelo)}
                        variant="outline"
                        size="xs"
                      >
                        Usar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ModelComparison;
