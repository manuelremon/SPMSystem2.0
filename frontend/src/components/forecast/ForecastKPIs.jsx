/**
 * ForecastKPIs - Tarjetas de métricas de forecast
 *
 * Muestra MAE, RMSE, R², MAPE en formato visual con tooltips explicativos
 */

import React from 'react';
import { useI18n } from '../../context/i18n';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const MetricCard = ({ label, value, formato = 'numero', descripcion, tooltip, color = 'blue', icon }) => {
  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (formato === 'porcentaje') return `${val.toFixed(1)}%`;  // Ya viene en porcentaje del backend
    if (formato === 'decimal') return val.toFixed(4);
    return val.toFixed(2);
  };

  const colorConfig = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      border: 'border-blue-200',
      text: 'text-blue-700',
      accent: 'bg-blue-500',
      valueText: 'text-blue-800'
    },
    green: {
      bg: 'bg-gradient-to-br from-green-50 to-emerald-100',
      border: 'border-green-200',
      text: 'text-green-700',
      accent: 'bg-green-500',
      valueText: 'text-green-800'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-violet-100',
      border: 'border-purple-200',
      text: 'text-purple-700',
      accent: 'bg-purple-500',
      valueText: 'text-purple-800'
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-amber-100',
      border: 'border-orange-200',
      text: 'text-orange-700',
      accent: 'bg-orange-500',
      valueText: 'text-orange-800'
    },
    red: {
      bg: 'bg-gradient-to-br from-red-50 to-rose-100',
      border: 'border-red-200',
      text: 'text-red-700',
      accent: 'bg-red-500',
      valueText: 'text-red-800'
    }
  };

  const config = colorConfig[color] || colorConfig.blue;

  return (
    <div className={`relative p-4 rounded-xl border shadow-sm overflow-hidden ${config.bg} ${config.border}`}>
      {/* Decorative accent */}
      <div className={`absolute top-0 left-0 w-1 h-full ${config.accent}`}></div>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-semibold ${config.text}`}>{label}</p>
            {tooltip && (
              <Tooltip
                title={tooltip}
                arrow
                placement="top"
                slotProps={{
                  tooltip: {
                    sx: {
                      fontSize: '0.75rem',
                      maxWidth: 280,
                      lineHeight: 1.5,
                      backgroundColor: 'var(--sidebar-bg)',
                      padding: '8px 12px'
                    }
                  }
                }}
              >
                <InfoOutlinedIcon sx={{ fontSize: 14, opacity: 0.5, cursor: 'help' }} className={config.text} />
              </Tooltip>
            )}
          </div>
          <p className={`text-3xl font-bold mt-2 ${config.valueText}`}>{formatValue(value)}</p>
          {descripcion && (
            <p className={`text-xs mt-1.5 ${config.text} opacity-75`}>{descripcion}</p>
          )}
        </div>
      </div>
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
        tooltip="Mean Absolute Error: Promedio de las diferencias absolutas entre predicción y valor real. Menor es mejor. Está en las mismas unidades que los datos."
        color="blue"
      />

      <MetricCard
        label={t('forecast_rmse', 'RMSE')}
        value={metricas.rmse}
        formato="numero"
        descripcion={t('forecast_rmse_desc', 'Error Cuadrático Medio')}
        tooltip="Root Mean Square Error: Similar a MAE pero penaliza más los errores grandes. Menor es mejor. Útil cuando errores grandes son especialmente problemáticos."
        color="purple"
      />

      <MetricCard
        label={t('forecast_r2', 'R²')}
        value={metricas.r2}
        formato="decimal"
        descripcion={getR2Description(metricas.r2)}
        tooltip="Coeficiente de Determinación: Indica qué porcentaje de la variabilidad de los datos explica el modelo. Va de 0 a 1, donde 1 es ajuste perfecto. >0.7 es bueno, >0.9 es excelente."
        color={getR2Color(metricas.r2)}
      />

      <MetricCard
        label={t('forecast_mape', 'MAPE')}
        value={metricas.mape}
        formato="porcentaje"
        descripcion={t('forecast_mape_desc', 'Error Porcentual')}
        tooltip="Mean Absolute Percentage Error: Error promedio expresado como porcentaje. Permite comparar precisión entre diferentes materiales. <10% es excelente, <20% es bueno."
        color="orange"
      />
    </div>
  );
};

export default ForecastKPIs;
