/**
 * Servicio de Forecast API
 *
 * Cliente para endpoints de forecast/predicción de demanda
 */

import api from './api';

/**
 * Obtiene los centros disponibles
 */
export const getCentros = async () => {
  const response = await api.get('/catalogos/centros');
  return response.data || [];
};

/**
 * Obtiene los almacenes disponibles
 */
export const getAlmacenes = async () => {
  const response = await api.get('/catalogos/almacenes');
  return response.data || [];
};

/**
 * Obtiene los modelos de forecast disponibles
 */
export const getModelsDisponibles = async () => {
  const response = await api.get('/ai/forecast/models');
  return response.data;
};

/**
 * Obtiene predicción de demanda para un material
 * @param {string} codigo - Código del material
 * @param {object} options - Opciones de forecast
 */
export const getForecast = async (codigo, options = {}) => {
  const { dias = 30, modelo = 'random_forest', centro = null, almacen = null } = options;
  const params = { dias, modelo };
  if (centro) params.centro = centro;
  if (almacen) params.almacen = almacen;

  const response = await api.get(`/ai/materiales/forecast/${codigo}`, { params });
  // Backend retorna { ok: true, data: {...} }, extraemos solo data
  return response.data?.data || response.data;
};

/**
 * Ejecuta backtesting para un material
 * @param {string} codigo - Código del material
 * @param {object} options - Opciones de backtesting
 */
export const runBacktest = async (codigo, options = {}) => {
  const { modelo = 'random_forest', ventana = 30, pasos = 5, centro = null } = options;

  const response = await api.post('/ai/forecast/backtest', {
    material_codigo: codigo,
    centro: centro || '1000',
    modelo,
    ventana_test: ventana,
    n_pasos: pasos
  });
  return response.data;
};

/**
 * Compara múltiples modelos para un material
 * @param {string} codigo - Código del material
 * @param {object} options - Opciones de comparación
 */
export const compareModels = async (codigo, options = {}) => {
  const { modelos = ['random_forest', 'gradient_boosting', 'linear'], centro = null } = options;

  const response = await api.post('/ai/forecast/compare', {
    material_codigo: codigo,
    centro: centro || '1000',
    modelos
  });
  return response.data;
};

/**
 * Auto-selección del mejor modelo
 * @param {string} codigo - Código del material
 * @param {object} options - Opciones de selección
 */
export const autoSelectModel = async (codigo, options = {}) => {
  const { optimizar = false, centro = null } = options;

  const response = await api.post('/ai/forecast/auto-select', {
    material_codigo: codigo,
    centro: centro || '1000',
    optimizar_params: optimizar
  });
  return response.data;
};

/**
 * Optimiza hiperparámetros de un modelo
 * @param {string} codigo - Código del material
 * @param {object} options - Opciones de tuning
 */
export const tuneHyperparameters = async (codigo, options = {}) => {
  const { modelo = 'random_forest', iteraciones = 30, centro = null } = options;

  const response = await api.post('/ai/forecast/tune', {
    material_codigo: codigo,
    centro: centro || '1000',
    modelo,
    n_iter: iteraciones
  });
  return response.data;
};

/**
 * Obtiene análisis completo de un material (incluye clustering, scoring, forecast)
 * @param {string} codigo - Código del material
 */
export const getAnalisisCompleto = async (codigo) => {
  const response = await api.get(`/ai/materiales/analisis/${codigo}`);
  return response.data;
};

/**
 * Obtiene clusters de materiales
 * @param {object} options - Opciones de clustering
 */
export const getClusters = async (options = {}) => {
  const { n_clusters = 5 } = options;
  const response = await api.get('/ai/clusters', { params: { n_clusters } });
  return response.data;
};

export default {
  getCentros,
  getAlmacenes,
  getModelsDisponibles,
  getForecast,
  runBacktest,
  compareModels,
  autoSelectModel,
  tuneHyperparameters,
  getAnalisisCompleto,
  getClusters
};
