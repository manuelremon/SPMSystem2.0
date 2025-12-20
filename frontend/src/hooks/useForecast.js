/**
 * Hook de Forecast
 *
 * Gestiona estado y lógica para predicción de demanda
 */

import { useState, useCallback, useEffect } from 'react';
import forecastService from '../services/forecast';

const MODELOS_NOMBRES = {
  random_forest: 'Random Forest',
  gradient_boosting: 'Gradient Boosting',
  linear: 'Regresión Lineal',
  xgboost: 'XGBoost',
  prophet: 'Prophet',
  arima: 'ARIMA'
};

export function useForecast() {
  // Estado principal
  const [materialCodigo, setMaterialCodigo] = useState('');
  const [modeloSeleccionado, setModeloSeleccionado] = useState('random_forest');
  const [diasPrediccion, setDiasPrediccion] = useState(30);
  const [centro, setCentro] = useState('');
  const [almacen, setAlmacen] = useState('');

  // Datos de forecast
  const [forecastData, setForecastData] = useState(null);
  const [backtestData, setBacktestData] = useState(null);
  const [comparacionData, setComparacionData] = useState(null);
  const [autoSelectData, setAutoSelectData] = useState(null);

  // Catálogos
  const [centrosDisponibles, setCentrosDisponibles] = useState([]);
  const [almacenesDisponibles, setAlmacenesDisponibles] = useState([]);
  const [modelosDisponibles, setModelosDisponibles] = useState([]);

  // Estados de carga
  const [loading, setLoading] = useState(false);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [loadingComparacion, setLoadingComparacion] = useState(false);
  const [loadingAutoSelect, setLoadingAutoSelect] = useState(false);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  // Errores
  const [error, setError] = useState(null);

  // Cargar catálogos al montar
  useEffect(() => {
    const loadCatalogos = async () => {
      setLoadingCatalogos(true);
      try {
        const [centrosRes, almacenesRes, modelosRes] = await Promise.all([
          forecastService.getCentros(),
          forecastService.getAlmacenes(),
          forecastService.getModelsDisponibles()
        ]);

        setCentrosDisponibles(centrosRes || []);
        setAlmacenesDisponibles(almacenesRes || []);

        if (modelosRes?.modelos) {
          setModelosDisponibles(modelosRes.modelos);
        } else {
          setModelosDisponibles(['random_forest', 'gradient_boosting', 'linear']);
        }
      } catch (err) {
        console.error('Error cargando catálogos:', err);
        setModelosDisponibles(['random_forest', 'gradient_boosting', 'linear']);
      } finally {
        setLoadingCatalogos(false);
      }
    };
    loadCatalogos();
  }, []);

  // Ejecutar forecast
  const ejecutarForecast = useCallback(async (codigo = materialCodigo) => {
    if (!codigo) {
      setError('Debe ingresar un código de material');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await forecastService.getForecast(codigo, {
        dias: diasPrediccion,
        modelo: modeloSeleccionado,
        centro,
        almacen
      });

      setForecastData(result);
      setMaterialCodigo(codigo);
      return result;
    } catch (err) {
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'object'
        ? (errorData.message || JSON.stringify(errorData))
        : (errorData || 'Error al generar forecast');
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [materialCodigo, diasPrediccion, modeloSeleccionado, centro, almacen]);

  // Ejecutar backtesting
  const ejecutarBacktest = useCallback(async (codigo = materialCodigo, opciones = {}) => {
    if (!codigo) {
      setError('Debe ingresar un código de material');
      return null;
    }

    setLoadingBacktest(true);
    setError(null);

    try {
      const result = await forecastService.runBacktest(codigo, {
        modelo: modeloSeleccionado,
        ventana: opciones.ventana || 30,
        pasos: opciones.pasos || 5,
        centro
      });

      setBacktestData(result);
      return result;
    } catch (err) {
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'object'
        ? (errorData.message || JSON.stringify(errorData))
        : (errorData || 'Error en backtesting');
      setError(message);
      return null;
    } finally {
      setLoadingBacktest(false);
    }
  }, [materialCodigo, modeloSeleccionado, centro]);

  // Comparar modelos
  const compararModelos = useCallback(async (codigo = materialCodigo, modelos = null) => {
    if (!codigo) {
      setError('Debe ingresar un código de material');
      return null;
    }

    setLoadingComparacion(true);
    setError(null);

    try {
      const result = await forecastService.compareModels(codigo, {
        modelos: modelos || modelosDisponibles,
        centro
      });

      setComparacionData(result);
      return result;
    } catch (err) {
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'object'
        ? (errorData.message || JSON.stringify(errorData))
        : (errorData || 'Error en comparación');
      setError(message);
      return null;
    } finally {
      setLoadingComparacion(false);
    }
  }, [materialCodigo, modelosDisponibles, centro]);

  // Auto-selección de modelo
  const autoSeleccionarModelo = useCallback(async (codigo = materialCodigo, opciones = {}) => {
    if (!codigo) {
      setError('Debe ingresar un código de material');
      return null;
    }

    setLoadingAutoSelect(true);
    setError(null);

    try {
      const result = await forecastService.autoSelectModel(codigo, {
        criterio: opciones.criterio || 'mae',
        optimizar: opciones.optimizar || false,
        centro
      });

      setAutoSelectData(result);

      // Actualizar modelo seleccionado con el mejor
      if (result.mejor_modelo) {
        setModeloSeleccionado(result.mejor_modelo);
      }

      return result;
    } catch (err) {
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'object'
        ? (errorData.message || JSON.stringify(errorData))
        : (errorData || 'Error en auto-selección');
      setError(message);
      return null;
    } finally {
      setLoadingAutoSelect(false);
    }
  }, [materialCodigo, centro]);

  // Limpiar datos
  const limpiar = useCallback(() => {
    setForecastData(null);
    setBacktestData(null);
    setComparacionData(null);
    setAutoSelectData(null);
    setError(null);
  }, []);

  // Obtener nombre legible del modelo
  const getNombreModelo = useCallback((modelo) => {
    return MODELOS_NOMBRES[modelo] || modelo;
  }, []);

  // Métricas resumidas del forecast actual
  const metricas = forecastData?.metricas || null;

  // Predicciones formateadas para gráficos
  const prediccionesParaGrafico = forecastData?.predicciones
    ? forecastData.predicciones.map((p, i) => ({
        fecha: p.fecha,
        prediccion: p.cantidad_predicha || p.prediccion,
        limiteInferior: p.limite_inferior,
        limiteSuperior: p.limite_superior,
        indice: i
      }))
    : [];

  // Histórico formateado para gráficos
  const historicoParaGrafico = forecastData?.historico
    ? forecastData.historico.map((h, i) => ({
        fecha: h.fecha,
        cantidad: h.cantidad,
        indice: i
      }))
    : [];

  return {
    // Estado
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

    // Datos
    forecastData,
    backtestData,
    comparacionData,
    autoSelectData,
    modelosDisponibles,
    centrosDisponibles,
    almacenesDisponibles,
    metricas,
    prediccionesParaGrafico,
    historicoParaGrafico,

    // Estados de carga
    loading,
    loadingBacktest,
    loadingComparacion,
    loadingAutoSelect,
    loadingCatalogos,

    // Error
    error,
    setError,

    // Acciones
    ejecutarForecast,
    ejecutarBacktest,
    compararModelos,
    autoSeleccionarModelo,
    limpiar,

    // Utilidades
    getNombreModelo
  };
}

export default useForecast;
