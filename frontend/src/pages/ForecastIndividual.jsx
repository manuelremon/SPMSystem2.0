/**
 * ForecastIndividual - Página de forecast de material individual
 *
 * Permite analizar y predecir demanda para un material específico
 */

import React, { useState, useCallback } from 'react';
import { useI18n } from '../context/i18n';
import { useForecast } from '../hooks/useForecast';
import {
  ForecastChart,
  ForecastKPIs,
  ModelSelector,
  BacktestResults,
  ModelComparison,
  PatternCharts,
  PredictionsTable,
  MaterialSearchInput
} from '../components/forecast';
import Loading from '../components/Loading';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { TempDataBanner } from '../components/ui/TempDataBanner';

const ForecastIndividual = () => {
  const { t } = useI18n();
  const {
    materialCodigo,
    setMaterialCodigo,
    modeloSeleccionado,
    setModeloSeleccionado,
    diasPrediccion,
    setDiasPrediccion,
    centro,
    setCentro,
    almacen,
    setAlmacen,
    modelosDisponibles,
    centrosDisponibles,
    almacenesDisponibles,
    forecastData,
    backtestData,
    comparacionData,
    metricas,
    prediccionesParaGrafico,
    historicoParaGrafico,
    loading,
    loadingBacktest,
    loadingComparacion,
    loadingCatalogos,
    error,
    ejecutarForecast,
    ejecutarBacktest,
    compararModelos,
    limpiar,
    getNombreModelo
  } = useForecast();

  // Estado local para tabs y modales
  const [activeTab, setActiveTab] = useState('forecast');
  const [showBacktest, setShowBacktest] = useState(false);
  const [showComparacion, setShowComparacion] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  // Manejar selección de material
  const handleMaterialSelect = useCallback((material) => {
    setSelectedMaterial(material);
    if (material) {
      setMaterialCodigo(material.codigo);
    }
  }, [setMaterialCodigo]);

  // Manejar búsqueda
  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (materialCodigo.trim()) {
      ejecutarForecast();
    }
  }, [materialCodigo, ejecutarForecast]);

  // Ejecutar backtesting
  const handleBacktest = useCallback(async () => {
    setShowBacktest(true);
    await ejecutarBacktest();
  }, [ejecutarBacktest]);

  // Comparar modelos
  const handleCompararModelos = useCallback(async () => {
    setShowComparacion(true);
    await compararModelos();
  }, [compararModelos]);

  // Seleccionar modelo de comparación
  const handleSelectModelFromComparison = useCallback((modelo) => {
    setModeloSeleccionado(modelo);
    ejecutarForecast();
  }, [setModeloSeleccionado, ejecutarForecast]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 uppercase">
          {t('forecast_titulo', 'Forecast de Demanda con Machine Learning')}
        </h1>
      </div>

      {/* Banner de Modo Temporal */}
      <TempDataBanner />

      {/* Formulario de búsqueda */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <form onSubmit={handleSearch}>
          {/* Primera fila: Material y filtros */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Búsqueda de material */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                {t('forecast_buscar_material', 'Buscar Material')}
              </label>
              <MaterialSearchInput
                value={materialCodigo}
                onChange={setMaterialCodigo}
                onSelect={handleMaterialSelect}
                selectedMaterial={selectedMaterial}
                placeholder={t('forecast_placeholder_buscar', 'Buscar por código o descripción...')}
                disabled={loading}
              />
            </div>

            {/* Centro */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                {t('forecast_centro', 'Centro')}
              </label>
              <Select
                value={centro}
                onChange={(e) => setCentro(e.target.value)}
                disabled={loading || loadingCatalogos}
              >
                <option value="">{t('forecast_todos_centros', 'Todos los centros')}</option>
                {centrosDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} - {c.nombre}
                  </option>
                ))}
              </Select>
            </div>

            {/* Almacén */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                {t('forecast_almacen', 'Almacén')}
              </label>
              <Select
                value={almacen}
                onChange={(e) => setAlmacen(e.target.value)}
                disabled={loading || loadingCatalogos}
              >
                <option value="">{t('forecast_todos_almacenes', 'Todos los almacenes')}</option>
                {almacenesDisponibles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} - {a.nombre}
                  </option>
                ))}
              </Select>
            </div>

            {/* Horizonte de predicción */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                {t('forecast_horizonte', 'Horizonte (meses)')}
              </label>
              <Select
                value={diasPrediccion}
                onChange={(e) => setDiasPrediccion(Number(e.target.value))}
              >
                <option value={30}>1 mes</option>
                <option value={90}>3 meses</option>
                <option value={180}>6 meses</option>
                <option value={240}>8 meses</option>
                <option value={300}>10 meses</option>
                <option value={365}>12 meses</option>
              </Select>
            </div>

            {/* Botón de búsqueda */}
            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !materialCodigo.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    {t('forecast_analizando', 'Analizando...')}
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    {t('forecast_analizar', 'Analizar')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Selector de modelo */}
          <div className="mt-4">
            <ModelSelector
              modelosDisponibles={modelosDisponibles}
              modeloSeleccionado={modeloSeleccionado}
              onChange={setModeloSeleccionado}
              disabled={loading}
              layout="dropdown"
            />
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Resultados */}
      {forecastData && (
        <>
          {/* Info del material */}
          <div className="bg-white rounded-lg border p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {forecastData.material?.codigo || selectedMaterial?.codigo || materialCodigo}
                </h2>
                <p className="text-slate-600">
                  {forecastData.material?.descripcion || selectedMaterial?.descripcion || t('forecast_material', 'Material')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {getNombreModelo(modeloSeleccionado)}
                </span>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                  {diasPrediccion} días
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 border-b border-slate-200">
            <nav className="flex space-x-4">
              {[
                { id: 'forecast', label: t('forecast_tab_forecast', 'Forecast'), icon: '📈' },
                { id: 'metricas', label: t('forecast_tab_metricas', 'Métricas'), icon: '📊' },
                { id: 'tabla', label: t('forecast_tab_tabla', 'Tabla'), icon: '📋' },
                { id: 'patrones', label: t('forecast_tab_patrones', 'Patrones'), icon: '🔄' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Contenido de tabs */}
          <div className="space-y-6">
            {activeTab === 'forecast' && (
              <>
                {/* KPIs */}
                <ForecastKPIs metricas={metricas} />

                {/* Gráfico principal */}
                <div className="bg-white rounded-lg border p-4">
                  <ForecastChart
                    historico={historicoParaGrafico}
                    predicciones={prediccionesParaGrafico}
                    titulo={`Forecast: ${materialCodigo} (${getNombreModelo(modeloSeleccionado)})`}
                    height={450}
                  />
                </div>

                {/* Acciones avanzadas */}
                <div className="flex gap-4">
                  <Button
                    onClick={handleBacktest}
                    disabled={loadingBacktest}
                    variant="accent"
                    size="sm"
                  >
                    {loadingBacktest ? '⏳ Ejecutando...' : '🧪 Backtesting'}
                  </Button>
                  <Button
                    onClick={handleCompararModelos}
                    disabled={loadingComparacion}
                    variant="success"
                    size="sm"
                  >
                    {loadingComparacion ? '⏳ Comparando...' : '⚖️ Comparar Modelos'}
                  </Button>
                  <Button
                    onClick={limpiar}
                    variant="secondary"
                    size="sm"
                  >
                    🗑️ Limpiar
                  </Button>
                </div>
              </>
            )}

            {activeTab === 'metricas' && (
              <div className="space-y-6">
                <ForecastKPIs metricas={metricas} />

                {/* Detalles de métricas */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">
                    {t('forecast_detalles_modelo', 'Detalles del Modelo')}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Modelo:</span>
                      <p className="font-medium">{getNombreModelo(modeloSeleccionado)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Datos históricos:</span>
                      <p className="font-medium">{historicoParaGrafico.length} días</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Predicciones:</span>
                      <p className="font-medium">{prediccionesParaGrafico.length} días</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Generado:</span>
                      <p className="font-medium">{new Date().toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tabla' && (
              <PredictionsTable
                predicciones={prediccionesParaGrafico}
                showIntervalos={true}
              />
            )}

            {activeTab === 'patrones' && (
              <PatternCharts
                patronSemanal={forecastData.patrones?.semanal}
                patronMensual={forecastData.patrones?.mensual}
              />
            )}
          </div>

          {/* Panel de Backtesting */}
          {showBacktest && (
            <div className="mt-6">
              <BacktestResults
                data={backtestData}
                loading={loadingBacktest}
              />
            </div>
          )}

          {/* Panel de Comparación */}
          {showComparacion && (
            <div className="mt-6">
              <ModelComparison
                data={comparacionData}
                loading={loadingComparacion}
                onSelectModel={handleSelectModelFromComparison}
              />
            </div>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!forecastData && !loading && (
        <div className="bg-white rounded-lg border p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {t('forecast_empty_titulo', 'Analiza la demanda de un material')}
          </h3>
          <p className="text-slate-600 max-w-md mx-auto">
            {t('forecast_empty_descripcion', 'Ingresa el código de un material para obtener predicciones de demanda basadas en histórico de consumo.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default ForecastIndividual;
