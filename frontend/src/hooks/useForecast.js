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
  // Iniciar vacío para evitar warning de MUI Select (se asigna al cargar modelos)
  const [modeloSeleccionado, setModeloSeleccionado] = useState('');
  const [diasPrediccion, setDiasPrediccion] = useState(30);
  const [mesesHistorico, setMesesHistorico] = useState(0); // 0 = todo el histórico
  const [centro, setCentro] = useState('');
  const [almacen, setAlmacen] = useState('');

  // Datos de forecast
  const [forecastData, setForecastData] = useState(null);
  const [backtestData, setBacktestData] = useState(null);
  const [comparacionData, setComparacionData] = useState(null);
  const [autoSelectData, setAutoSelectData] = useState(null);

  // Estado de simulación (cold start)
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationParams, setSimulationParams] = useState(null);

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

      // Cargar catálogos primero (no requieren auth especial)
      try {
        const [centrosRes, almacenesRes] = await Promise.all([
          forecastService.getCentros(),
          forecastService.getAlmacenes()
        ]);
        setCentrosDisponibles(centrosRes || []);
        setAlmacenesDisponibles(almacenesRes || []);
      } catch (err) {
      }

      // Cargar modelos (requiere auth, puede fallar independiente)
      try {
        const modelosRes = await forecastService.getModelsDisponibles();
        let modelos = [];
        if (modelosRes?.modelos && modelosRes?.nombres) {
          // Transformar a array de objetos {id, nombre}
          modelos = modelosRes.modelos.map(id => ({
            id,
            nombre: modelosRes.nombres[id] || MODELOS_NOMBRES[id] || id
          }));
        } else if (modelosRes?.modelos) {
          // Solo IDs disponibles, usar nombres locales
          modelos = modelosRes.modelos.map(id => ({
            id,
            nombre: MODELOS_NOMBRES[id] || id
          }));
        } else {
          // Fallback con objetos
          modelos = [
            { id: 'random_forest', nombre: 'Random Forest' },
            { id: 'gradient_boosting', nombre: 'Gradient Boosting' },
            { id: 'linear', nombre: 'Regresión Lineal' }
          ];
        }
        setModelosDisponibles(modelos);
        // Establecer modelo por defecto si no hay uno seleccionado
        if (modelos.length > 0) {
          setModeloSeleccionado(prev => prev || modelos[0].id);
        }
      } catch (err) {
        // Fallback con objetos
        const fallbackModelos = [
          { id: 'random_forest', nombre: 'Random Forest' },
          { id: 'gradient_boosting', nombre: 'Gradient Boosting' },
          { id: 'linear', nombre: 'Regresión Lineal' }
        ];
        setModelosDisponibles(fallbackModelos);
        setModeloSeleccionado(prev => prev || 'random_forest');
      }

      setLoadingCatalogos(false);
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
        almacen,
        mesesHistorico
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
  }, [materialCodigo, diasPrediccion, modeloSeleccionado, centro, almacen, mesesHistorico]);

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

  // Generar datos sintéticos para cold start (simulación)
  // Soporta customPredictions para ForecastPlaceholder con formula SS = 1.65 * sqrt(LT/30) * sigma
  const generateSyntheticData = useCallback(({ consumoMensual, volatilidad, leadTime, customPredictions }) => {
    let predicciones;
    let safetyStock;

    if (customPredictions && customPredictions.length > 0) {
      // Usar predicciones custom del ForecastPlaceholder (formula SS estadistica)
      predicciones = customPredictions.map(p => ({
        fecha: p.fecha,
        cantidad_predicha: p.prediccion,
        prediccion: p.prediccion,
        limite_inferior: p.limiteInferior,
        limite_superior: p.limiteSuperior,
        limiteInferior: p.limiteInferior,
        limiteSuperior: p.limiteSuperior,
      }));
      // SS ya calculado con formula: 1.65 * sqrt(LT/30) * (consumo * buffer)
      const sigmaEstimada = consumoMensual * volatilidad;
      safetyStock = 1.65 * Math.sqrt(leadTime / 30) * sigmaEstimada;
    } else {
      // Generacion original con jitter
      predicciones = [];
      const today = new Date();

      // Generar 12 meses de predicciones
      for (let i = 1; i <= 12; i++) {
        const fecha = new Date(today.getFullYear(), today.getMonth() + i, 1);
        // Jitter orgánico de ±5% para que no sea línea plana
        const jitter = 1 + (Math.random() * 0.1 - 0.05);

        const prediccion = consumoMensual * jitter;
        const limiteSuperior = consumoMensual * (1 + volatilidad) * jitter;
        const limiteInferior = Math.max(0, consumoMensual * (1 - volatilidad) * jitter);

        predicciones.push({
          fecha: fecha.toISOString().split('T')[0],
          cantidad_predicha: prediccion,
          prediccion: prediccion,
          limite_inferior: limiteInferior,
          limite_superior: limiteSuperior,
          limiteInferior: limiteInferior,
          limiteSuperior: limiteSuperior,
        });
      }

      // Calcular Safety Stock original: (consumo diario) * lead time
      const consumoDiario = consumoMensual / 30;
      safetyStock = consumoDiario * leadTime;
    }

    // Almacenar parámetros de simulación
    setSimulationParams({ consumoMensual, volatilidad, leadTime });
    setSimulationMode(true);

    // Actualizar forecastData con datos simulados
    setForecastData({
      predicciones,
      historico: [], // Sin histórico en simulación
      metricas: null,
      simulationMode: true,
      safetyStock,
      parametros: { consumoMensual, volatilidad, leadTime },
      nombre_modelo: 'Simulación',
      dias: 365,
    });

    // Limpiar datos de backtesting y comparación (no aplican en simulación)
    setBacktestData(null);
    setComparacionData(null);
    setAutoSelectData(null);
    setError(null);
  }, []);

  // Salir del modo simulación
  const exitSimulationMode = useCallback(() => {
    setSimulationMode(false);
    setSimulationParams(null);
    setForecastData(null);
  }, []);

  // Limpiar datos
  const limpiar = useCallback(() => {
    setForecastData(null);
    setBacktestData(null);
    setComparacionData(null);
    setAutoSelectData(null);
    setSimulationMode(false);
    setSimulationParams(null);
    setError(null);
  }, []);

  // Obtener nombre legible del modelo
  const getNombreModelo = useCallback((modelo) => {
    if (!modelo) return 'Sin modelo';
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

  // Información del histórico utilizado
  const historicoInfo = forecastData?.historico_info || null;

  return {
    // Estado
    materialCodigo,
    setMaterialCodigo,
    modeloSeleccionado,
    setModeloSeleccionado,
    diasPrediccion,
    setDiasPrediccion,
    mesesHistorico,
    setMesesHistorico,
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
    historicoInfo,

    // Estados de carga
    loading,
    loadingBacktest,
    loadingComparacion,
    loadingAutoSelect,
    loadingCatalogos,

    // Error
    error,
    setError,

    // Simulación (Cold Start)
    simulationMode,
    simulationParams,
    generateSyntheticData,
    exitSimulationMode,

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
