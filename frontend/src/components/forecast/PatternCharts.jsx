/**
 * PatternCharts - Gráficos de patrones de demanda
 *
 * Muestra patrones semanales y mensuales
 */

import React from 'react';
import LazyPlot from './LazyPlot';
import { useI18n } from '../../context/i18n';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PatternCharts = ({
  patronSemanal = null,
  patronMensual = null,
  loading = false,
  className = ''
}) => {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
        {[1, 2].map(i => (
          <div key={i} className="p-4 bg-white rounded-lg border animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-32 mb-3"></div>
            <div className="h-48 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const semanalData = patronSemanal ? [{
    x: DIAS_SEMANA,
    y: Object.values(patronSemanal),
    type: 'bar',
    marker: {
      color: DIAS_SEMANA.map((_, i) =>
        i === 4 || i === 5 ? '#10b981' : '#3b82f6'
      )
    },
    text: Object.values(patronSemanal).map(v => v?.toFixed(1)),
    textposition: 'outside'
  }] : [];

  const mensualData = patronMensual ? [{
    x: MESES,
    y: Object.values(patronMensual),
    type: 'bar',
    marker: { color: '#8b5cf6' },
    text: Object.values(patronMensual).map(v => v?.toFixed(1)),
    textposition: 'outside'
  }] : [];

  const semanalLayout = {
    title: t('forecast_patron_semanal', 'Patrón Semanal'),
    xaxis: { title: '' },
    yaxis: { title: t('forecast_demanda_promedio', 'Demanda Promedio') },
    margin: { t: 40, r: 20, b: 40, l: 50 },
    height: 250,
    showlegend: false
  };

  const mensualLayout = {
    title: t('forecast_patron_mensual', 'Patrón Mensual'),
    xaxis: { title: '' },
    yaxis: { title: t('forecast_demanda_promedio', 'Demanda Promedio') },
    margin: { t: 40, r: 20, b: 40, l: 50 },
    height: 250,
    showlegend: false
  };

  const config = { responsive: true, displaylogo: false };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Patrón semanal */}
      <div className="p-4 bg-white rounded-lg border">
        {patronSemanal ? (
          <LazyPlot
            data={semanalData}
            layout={semanalLayout}
            config={config}
            style={{ width: '100%' }}
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400">
            {t('forecast_sin_patron_semanal', 'Sin datos de patrón semanal')}
          </div>
        )}
      </div>

      {/* Patrón mensual */}
      <div className="p-4 bg-white rounded-lg border">
        {patronMensual ? (
          <LazyPlot
            data={mensualData}
            layout={mensualLayout}
            config={config}
            style={{ width: '100%' }}
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400">
            {t('forecast_sin_patron_mensual', 'Sin datos de patrón mensual')}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternCharts;
