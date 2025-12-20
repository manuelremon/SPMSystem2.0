/**
 * ForecastKPIs - Tarjetas de métricas de forecast
 *
 * Muestra MAE, RMSE, R², MAPE en formato visual
 */

import React from 'react';
import { useI18n } from '../../context/i18n';

const MetricCard = ({ label, value, formato = 'numero', descripcion, color = 'blue' }) => {
  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (formato === 'porcentaje') return `${(val * 100).toFixed(1)}%`;
    if (formato === 'decimal') return val.toFixed(4);
    return val.toFixed(2);
  };

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700'
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{formatValue(value)}</p>
      {descripcion && (
        <p className="text-xs mt-1 opacity-70">{descripcion}</p>
      )}
    </div>
  );
};

const ForecastKPIs = ({ metricas, className = '' }) => {
  const { t } = useI18n();

  if (!metricas) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-4 rounded-lg border bg-slate-50 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-16 mb-2"></div>
            <div className="h-8 bg-slate-200 rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  const getR2Color = (r2) => {
    if (r2 >= 0.9) return 'green';
    if (r2 >= 0.7) return 'blue';
    if (r2 >= 0.5) return 'orange';
    return 'red';
  };

  const getR2Description = (r2) => {
    if (r2 >= 0.9) return t('forecast_r2_excelente', 'Excelente ajuste');
    if (r2 >= 0.7) return t('forecast_r2_bueno', 'Buen ajuste');
    if (r2 >= 0.5) return t('forecast_r2_moderado', 'Ajuste moderado');
    return t('forecast_r2_bajo', 'Ajuste bajo');
  };

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      <MetricCard
        label={t('forecast_mae', 'MAE')}
        value={metricas.mae}
        formato="numero"
        descripcion={t('forecast_mae_desc', 'Error Absoluto Medio')}
        color="blue"
      />

      <MetricCard
        label={t('forecast_rmse', 'RMSE')}
        value={metricas.rmse}
        formato="numero"
        descripcion={t('forecast_rmse_desc', 'Error Cuadrático Medio')}
        color="purple"
      />

      <MetricCard
        label={t('forecast_r2', 'R²')}
        value={metricas.r2}
        formato="decimal"
        descripcion={getR2Description(metricas.r2)}
        color={getR2Color(metricas.r2)}
      />

      <MetricCard
        label={t('forecast_mape', 'MAPE')}
        value={metricas.mape}
        formato="porcentaje"
        descripcion={t('forecast_mape_desc', 'Error Porcentual')}
        color="orange"
      />
    </div>
  );
};

export default ForecastKPIs;
