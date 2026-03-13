/**
 * PatternCharts - Graficos de patrones de demanda con Chart.js
 *
 * Muestra patrones semanales y mensuales
 */

import React, { useMemo } from 'react';
import { SPMBar } from '../ui/SPMChartJS';
import { useI18n } from '../../context/i18n';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Colores MUI oficial
const COLORS = {
  semanal: 'var(--primary)',      // MUI Blue 700
  finDeSemana: 'var(--success-text)',  // MUI Green 800
  mensual: 'var(--purple-dark)',      // MUI Purple 500
};

const PatternCharts = ({
  patronSemanal = null,
  patronMensual = null,
  loading = false,
  className = ''
}) => {
  const { t } = useI18n();

  // Preparar datos semanales (claves son "0"-"6" como strings)
  const semanalData = useMemo(() => {
    if (!patronSemanal || typeof patronSemanal !== 'object') return { values: [], colors: [] };
    // Ordenar por clave numérica (0-6)
    const values = [];
    for (let i = 0; i < 7; i++) {
      const val = patronSemanal[String(i)] ?? patronSemanal[i] ?? 0;
      values.push(typeof val === 'number' ? val : parseFloat(val) || 0);
    }
    const colors = DIAS_SEMANA.map((_, i) =>
      i >= 5 ? COLORS.finDeSemana : COLORS.semanal
    );
    return { values, colors };
  }, [patronSemanal]);

  // Preparar datos mensuales (claves son "1"-"12" como strings)
  const mensualData = useMemo(() => {
    if (!patronMensual || typeof patronMensual !== 'object') return [];
    // Ordenar por clave numérica (1-12)
    const values = [];
    for (let i = 1; i <= 12; i++) {
      const val = patronMensual[String(i)] ?? patronMensual[i] ?? 0;
      values.push(typeof val === 'number' ? val : parseFloat(val) || 0);
    }
    return values;
  }, [patronMensual]);

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

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Patron semanal */}
      <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          {t('forecast_patron_semanal', 'Patron Semanal')}
        </h3>
        <p className="text-xs text-slate-500 mb-2">Consumo promedio por día de la semana</p>
        {semanalData.values.length > 0 && semanalData.values.some(v => v > 0) ? (
          <SPMBar
            labels={DIAS_SEMANA}
            datasets={[{
              label: 'Consumo',
              data: semanalData.values,
              backgroundColor: COLORS.semanal,
            }]}
            height={240}
            options={{
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => context.parsed.y?.toFixed(1) || '0',
                  },
                },
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 bg-slate-50 rounded-lg">
            {t('forecast_sin_patron_semanal', 'Sin datos de patron semanal')}
          </div>
        )}
      </div>

      {/* Patron mensual */}
      <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500"></span>
          {t('forecast_patron_mensual', 'Patron Mensual')}
        </h3>
        <p className="text-xs text-slate-500 mb-2">Consumo promedio por mes del año</p>
        {mensualData.length > 0 && mensualData.some(v => v > 0) ? (
          <SPMBar
            labels={MESES}
            datasets={[{
              label: 'Consumo',
              data: mensualData,
              backgroundColor: COLORS.mensual,
            }]}
            height={240}
            options={{
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => context.parsed.y?.toFixed(1) || '0',
                  },
                },
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 bg-slate-50 rounded-lg">
            {t('forecast_sin_patron_mensual', 'Sin datos de patron mensual')}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternCharts;
