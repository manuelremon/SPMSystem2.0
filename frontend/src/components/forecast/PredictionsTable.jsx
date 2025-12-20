/**
 * PredictionsTable - Tabla de predicciones
 *
 * Muestra las predicciones en formato tabular con detalles
 */

import React, { useState } from 'react';
import { useI18n } from '../../context/i18n';

const PredictionsTable = ({
  predicciones = [],
  loading = false,
  showIntervalos = true,
  className = ''
}) => {
  const { t } = useI18n();
  const [sortField, setSortField] = useState('fecha');
  const [sortDir, setSortDir] = useState('asc');

  if (loading) {
    return (
      <div className={`p-4 bg-white rounded-lg border ${className}`}>
        <div className="animate-pulse">
          <div className="h-5 bg-slate-200 rounded w-32 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-slate-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!predicciones || predicciones.length === 0) {
    return (
      <div className={`p-6 bg-white rounded-lg border text-center ${className}`}>
        <p className="text-slate-500">{t('forecast_sin_predicciones', 'No hay predicciones disponibles')}</p>
      </div>
    );
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedData = [...predicciones].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const dir = sortDir === 'asc' ? 1 : -1;

    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal) * dir;
    }
    return (aVal - bVal) * dir;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${className}`}>
      <div className="p-4 border-b bg-slate-50">
        <h3 className="font-semibold text-slate-900">
          {t('forecast_tabla_predicciones', 'Predicciones Detalladas')}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {predicciones.length} {t('forecast_dias', 'días')}
        </p>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)] sticky top-0">
            <tr>
              <th
                className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('fecha')}
              >
                {t('forecast_fecha', 'Fecha')}
                <SortIcon field="fecha" />
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('prediccion')}
              >
                {t('forecast_prediccion', 'Predicción')}
                <SortIcon field="prediccion" />
              </th>
              {showIntervalos && (
                <>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                    {t('forecast_minimo', 'Mínimo')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                    {t('forecast_maximo', 'Máximo')}
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                {t('forecast_dia_semana', 'Día')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((p, i) => {
              const fecha = new Date(p.fecha);
              const diaSemana = fecha.toLocaleDateString('es', { weekday: 'short' });
              const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;

              return (
                <tr
                  key={i}
                  className={`border-b border-slate-100 hover:bg-slate-50 ${
                    esFinDeSemana ? 'bg-slate-50' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-slate-900">
                    {fecha.toLocaleDateString('es', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-blue-600">
                    {p.prediccion?.toFixed(1) || '-'}
                  </td>
                  {showIntervalos && (
                    <>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {p.limiteInferior?.toFixed(1) || '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {p.limiteSuperior?.toFixed(1) || '-'}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      esFinDeSemana
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {diaSemana}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumen */}
      <div className="p-4 border-t bg-slate-50 grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Total:</span>
          <span className="ml-2 font-medium">
            {predicciones.reduce((sum, p) => sum + (p.prediccion || 0), 0).toFixed(0)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Promedio:</span>
          <span className="ml-2 font-medium">
            {(predicciones.reduce((sum, p) => sum + (p.prediccion || 0), 0) / predicciones.length).toFixed(1)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Máximo:</span>
          <span className="ml-2 font-medium">
            {Math.max(...predicciones.map(p => p.prediccion || 0)).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PredictionsTable;
