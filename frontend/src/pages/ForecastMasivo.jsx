/**
 * ForecastMasivo - Página de forecast masivo de materiales
 *
 * Permite analizar múltiples materiales simultáneamente
 */

import React, { useState, useCallback } from 'react';
import { useI18n } from '../context/i18n';
import forecastService from '../services/forecast';
import { ForecastKPIs, ModelSelector } from '../components/forecast';
import Loading from '../components/Loading';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { TempDataBanner } from '../components/ui/TempDataBanner';

const ForecastMasivo = () => {
  const { t } = useI18n();

  // Estado
  const [codigosMateriales, setCodigosMateriales] = useState('');
  const [modeloSeleccionado, setModeloSeleccionado] = useState('random_forest');
  const [diasPrediccion, setDiasPrediccion] = useState(30);
  const [modelosDisponibles, setModelosDisponibles] = useState(['random_forest', 'gradient_boosting', 'linear']);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [error, setError] = useState(null);

  // Cargar modelos disponibles
  React.useEffect(() => {
    const loadModelos = async () => {
      try {
        const response = await forecastService.getModelsDisponibles();
        if (response.modelos) {
          setModelosDisponibles(response.modelos);
        }
      } catch (err) {
        console.error('Error cargando modelos:', err);
      }
    };
    loadModelos();
  }, []);

  // Parsear códigos de materiales
  const parsearCodigos = useCallback((texto) => {
    return texto
      .split(/[\n,;]+/)
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length > 0);
  }, []);

  // Ejecutar forecast masivo
  const ejecutarForecastMasivo = useCallback(async () => {
    const codigos = parsearCodigos(codigosMateriales);

    if (codigos.length === 0) {
      setError(t('forecast_masivo_sin_codigos', 'Ingrese al menos un código de material'));
      return;
    }

    setLoading(true);
    setError(null);
    setResultados([]);
    setProgreso({ actual: 0, total: codigos.length });

    const resultadosTemp = [];

    for (let i = 0; i < codigos.length; i++) {
      const codigo = codigos[i];
      setProgreso({ actual: i + 1, total: codigos.length });

      try {
        const resultado = await forecastService.getForecast(codigo, {
          dias: diasPrediccion,
          modelo: modeloSeleccionado
        });

        resultadosTemp.push({
          codigo,
          exito: true,
          metricas: resultado.metricas,
          prediccionTotal: resultado.predicciones?.reduce((sum, p) => sum + (p.prediccion || p.cantidad_predicha || 0), 0) || 0,
          descripcion: resultado.material?.descripcion || '',
          modelo: modeloSeleccionado
        });
      } catch (err) {
        resultadosTemp.push({
          codigo,
          exito: false,
          error: err.response?.data?.error || 'Error desconocido'
        });
      }

      // Actualizar resultados parciales
      setResultados([...resultadosTemp]);
    }

    setLoading(false);
  }, [codigosMateriales, diasPrediccion, modeloSeleccionado, parsearCodigos, t]);

  // Exportar resultados a CSV
  const exportarCSV = useCallback(() => {
    if (resultados.length === 0) return;

    const headers = ['Código', 'Descripción', 'Estado', 'MAE', 'RMSE', 'R²', 'Predicción Total', 'Modelo'];
    const rows = resultados.map(r => [
      r.codigo,
      r.descripcion || '',
      r.exito ? 'OK' : 'Error',
      r.metricas?.mae?.toFixed(2) || '',
      r.metricas?.rmse?.toFixed(2) || '',
      r.metricas?.r2?.toFixed(4) || '',
      r.prediccionTotal?.toFixed(0) || '',
      r.modelo || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast_masivo_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [resultados]);

  // Estadísticas de resultados
  const stats = React.useMemo(() => {
    if (resultados.length === 0) return null;

    const exitosos = resultados.filter(r => r.exito);
    const fallidos = resultados.filter(r => !r.exito);

    return {
      total: resultados.length,
      exitosos: exitosos.length,
      fallidos: fallidos.length,
      maePromedio: exitosos.length > 0
        ? exitosos.reduce((sum, r) => sum + (r.metricas?.mae || 0), 0) / exitosos.length
        : 0,
      r2Promedio: exitosos.length > 0
        ? exitosos.reduce((sum, r) => sum + (r.metricas?.r2 || 0), 0) / exitosos.length
        : 0,
      prediccionTotal: exitosos.reduce((sum, r) => sum + (r.prediccionTotal || 0), 0)
    };
  }, [resultados]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 uppercase">
          {t('forecast_masivo_titulo', 'Forecast Masivo')}
        </h1>
        <p className="text-slate-600 mt-1">
          {t('forecast_masivo_subtitulo', 'Analiza múltiples materiales simultáneamente')}
        </p>
      </div>

      {/* Banner de Modo Temporal */}
      <TempDataBanner />

      {/* Formulario */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Códigos de materiales */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
              {t('forecast_masivo_codigos', 'Códigos de Materiales')}
            </label>
            <Textarea
              value={codigosMateriales}
              onChange={(e) => setCodigosMateriales(e.target.value)}
              placeholder="Ingrese códigos separados por comas, punto y coma, o en líneas separadas:&#10;MAT001&#10;MAT002, MAT003&#10;MAT004; MAT005"
              rows={6}
              className="font-mono"
            />
            <p className="mt-1 text-sm text-slate-500">
              {parsearCodigos(codigosMateriales).length} materiales detectados
            </p>
          </div>

          {/* Configuración */}
          <div className="space-y-4">
            <ModelSelector
              modelosDisponibles={modelosDisponibles}
              modeloSeleccionado={modeloSeleccionado}
              onChange={setModeloSeleccionado}
              disabled={loading}
              layout="dropdown"
            />

            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                {t('forecast_dias', 'Días de predicción')}
              </label>
              <Select
                value={diasPrediccion}
                onChange={(e) => setDiasPrediccion(Number(e.target.value))}
                disabled={loading}
              >
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
              </Select>
            </div>

            <Button
              onClick={ejecutarForecastMasivo}
              disabled={loading || parsearCodigos(codigosMateriales).length === 0}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {t('forecast_masivo_procesando', 'Procesando...')} ({progreso.actual}/{progreso.total})
                </>
              ) : (
                <>
                  <span>🚀</span>
                  {t('forecast_masivo_ejecutar', 'Ejecutar Forecast Masivo')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Progreso */}
      {loading && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Procesando materiales...</span>
            <span className="text-sm text-slate-500">{progreso.actual} de {progreso.total}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progreso.actual / progreso.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600">Exitosos</p>
            <p className="text-2xl font-bold text-green-700">{stats.exitosos}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">Fallidos</p>
            <p className="text-2xl font-bold text-red-700">{stats.fallidos}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600">MAE Promedio</p>
            <p className="text-2xl font-bold text-blue-700">{stats.maePromedio.toFixed(2)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-600">R² Promedio</p>
            <p className="text-2xl font-bold text-purple-700">{stats.r2Promedio.toFixed(4)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-600">Demanda Total</p>
            <p className="text-2xl font-bold text-orange-700">{stats.prediccionTotal.toFixed(0)}</p>
          </div>
        </div>
      )}

      {/* Tabla de resultados */}
      {resultados.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {t('forecast_masivo_resultados', 'Resultados')}
            </h3>
            <Button
              onClick={exportarCSV}
              variant="success"
              size="sm"
            >
              📥 Exportar CSV
            </Button>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)] sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Código</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Descripción</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">MAE</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">RMSE</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">R²</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Predicción Total</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${!r.exito ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2 font-medium text-slate-900">{r.codigo}</td>
                    <td className="px-4 py-2 text-slate-600 max-w-xs truncate">
                      {r.descripcion || (r.error ? r.error : '-')}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {r.exito ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">OK</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Error</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{r.metricas?.mae?.toFixed(2) || '-'}</td>
                    <td className="px-4 py-2 text-right">{r.metricas?.rmse?.toFixed(2) || '-'}</td>
                    <td className="px-4 py-2 text-right">{r.metricas?.r2?.toFixed(4) || '-'}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {r.prediccionTotal?.toFixed(0) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {resultados.length === 0 && !loading && (
        <div className="bg-white rounded-lg border p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {t('forecast_masivo_empty_titulo', 'Analiza múltiples materiales')}
          </h3>
          <p className="text-slate-600 max-w-md mx-auto">
            {t('forecast_masivo_empty_descripcion', 'Ingresa una lista de códigos de materiales para obtener predicciones de demanda en lote.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default ForecastMasivo;
