/**
 * ModelSelector - Selector de modelo de forecast
 *
 * Permite seleccionar entre los modelos disponibles
 */

import React from 'react';
import { useI18n } from '../../context/i18n';

const MODELOS_INFO = {
  random_forest: {
    nombre: 'Random Forest',
    descripcion: 'Ensemble de árboles de decisión. Robusto y versátil.',
    icono: '🌲'
  },
  gradient_boosting: {
    nombre: 'Gradient Boosting',
    descripcion: 'Boosting de árboles. Alta precisión.',
    icono: '🚀'
  },
  linear: {
    nombre: 'Regresión Lineal',
    descripcion: 'Modelo simple y rápido. Buena base.',
    icono: '📈'
  },
  xgboost: {
    nombre: 'XGBoost',
    descripcion: 'Boosting optimizado. Excelente rendimiento.',
    icono: '⚡'
  },
  prophet: {
    nombre: 'Prophet',
    descripcion: 'Especializado en series temporales.',
    icono: '🔮'
  },
  arima: {
    nombre: 'ARIMA',
    descripcion: 'Modelo estadístico clásico.',
    icono: '📊'
  }
};

const ModelSelector = ({
  modelosDisponibles = [],
  modeloSeleccionado,
  onChange,
  disabled = false,
  showDescriptions = true,
  layout = 'grid', // 'grid' | 'dropdown'
  className = ''
}) => {
  const { t } = useI18n();

  if (layout === 'dropdown') {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {t('forecast_modelo', 'Modelo')}
        </label>
        <select
          value={modeloSeleccionado}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
        >
          {modelosDisponibles.map(modelo => (
            <option key={modelo} value={modelo}>
              {MODELOS_INFO[modelo]?.icono} {MODELOS_INFO[modelo]?.nombre || modelo}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-3">
        {t('forecast_seleccionar_modelo', 'Seleccionar Modelo')}
      </label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {modelosDisponibles.map(modelo => {
          const info = MODELOS_INFO[modelo] || { nombre: modelo, descripcion: '', icono: '🔧' };
          const isSelected = modeloSeleccionado === modelo;

          return (
            <button
              key={modelo}
              type="button"
              onClick={() => onChange(modelo)}
              disabled={disabled}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{info.icono}</span>
                <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                  {info.nombre}
                </span>
              </div>
              {showDescriptions && (
                <p className={`text-xs ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                  {info.descripcion}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModelSelector;
