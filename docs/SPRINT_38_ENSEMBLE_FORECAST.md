# Sprint 38: ML Ensemble Forecast

## Resumen

Sprint 38 implementa un sistema de predicción ensemble que combina múltiples modelos de forecasting usando weighted averaging. Los pesos se calculan automáticamente basándose en el rendimiento (1/MAPE) de cada modelo individual.

## Archivos Creados

### Backend

1. **`backend/agent/pipelines/forecast/ensemble.py`** (378 líneas)
   - Clase `EnsembleStrategy` que implementa `ForecastStrategy`
   - Combina múltiples modelos usando weighted averaging
   - Entrenamiento y predicción en paralelo (ThreadPoolExecutor, max_workers=4)
   - Pesos automáticos basados en 1/MAPE o pesos manuales
   - Métodos principales:
     - `entrenar()`: Entrena todos los modelos en paralelo y calcula pesos
     - `predecir()`: Combina predicciones de todos los modelos
     - `get_weights()`: Retorna pesos de cada modelo
     - `get_individual_predictions()`: Predicciones de cada modelo individual
     - `get_feature_importance()`: Feature importance agregado

2. **`backend/routes/ai/forecast.py`** (actualizado)
   - Nuevo endpoint: `GET /api/ai/forecast/ensemble/<material>`
   - Query params:
     - `periodos`: int (default 30)
     - `modelos`: comma-separated list (default: todos disponibles excepto ensemble, lstm, stl)
     - `centro`: string (filtro de centro)
   - Retorna:
     - `ensemble`: predicciones, métricas, pesos, n_modelos
     - `individuales`: array de {modelo, predicciones, metricas, peso}

3. **`backend/agent/pipelines/forecast/__init__.py`** (actualizado)
   - Registra `EnsembleStrategy` como estrategia disponible
   - Exporta `EnsembleStrategy` en `__all__`

### Frontend

4. **`frontend/src/components/forecast/EnsembleChart.jsx`** (358 líneas)
   - Componente React para visualización de ensemble
   - Gráfico Chart.js con:
     - Predicciones individuales (líneas semi-transparentes con dash)
     - Intervalo de confianza del ensemble (área sombreada)
     - Predicción ensemble (línea destacada, 3px)
   - Tabla de pesos y métricas:
     - Muestra peso, MAE, MAPE, RMSE, R² de cada modelo
     - Ordenada por peso descendente
     - Fila de resumen del ensemble
     - Color coding según rendimiento (R² > 0.7 = verde, etc.)
   - Props:
     - `ensembleData`: {predicciones, metricas, pesos, n_modelos}
     - `individualData`: [{modelo, predicciones, metricas, peso}]
     - `weights`: {nombre_modelo: peso}
     - `metricas`: {mae, rmse, r2, mape}
     - `height`: número (default 400)
     - `showTable`: boolean (default true)

### Tests

5. **`tests/unit/test_ensemble_forecast.py`** (205 líneas)
   - 11 tests unitarios, todos pasando
   - Cobertura:
     - Inicialización
     - Entrenamiento
     - Predicción
     - Cálculo de pesos (automáticos y manuales)
     - Predicciones individuales
     - Feature importance
     - Casos edge: sin estrategias, datos insuficientes
     - Entrenamiento paralelo

## Características Técnicas

### Algoritmo de Pesos

```python
# Pesos proporcionales a 1/MAPE
mapes = [max(modelo.mape, 0.1) for modelo in modelos]  # Evitar división por cero
inverse_mapes = [1.0 / mape for mape in mapes]
weights = inverse_mapes / sum(inverse_mapes)  # Normalizar a suma = 1
```

### Combinación de Predicciones

- **Predicción**: Weighted average simple
- **Intervalo inferior**: Weighted average de límites inferiores (conservador)
- **Intervalo superior**: Weighted average de límites superiores (conservador)

### Paralelización

- **Entrenamiento**: Todos los modelos se entrenan en paralelo (ThreadPoolExecutor, max_workers=4)
- **Predicción**: Todas las predicciones se generan en paralelo (ThreadPoolExecutor, max_workers=4)
- **Timeout**: Sin timeout explícito, confía en que cada modelo maneja su propio timeout

## Uso

### Backend

```python
from backend.agent.pipelines.forecast import (
    EnsembleStrategy,
    RandomForestStrategy,
    GradientBoostingStrategy,
    XGBoostStrategy
)

# Crear estrategias
strategies = [
    RandomForestStrategy(),
    GradientBoostingStrategy(),
    XGBoostStrategy()
]

# Crear ensemble
ensemble = EnsembleStrategy(strategies=strategies)

# Entrenar
metricas = ensemble.entrenar(df_historico)

# Predecir
predicciones = ensemble.predecir(df_historico, periodos=30)

# Obtener pesos
pesos = ensemble.get_weights()
# {'Random Forest': 0.35, 'Gradient Boosting': 0.45, 'XGBoost': 0.20}

# Obtener predicciones individuales
individuales = ensemble.get_individual_predictions(df_historico, periodos=30)
```

### API

```bash
# Ensemble con modelos por defecto
curl -X GET "http://localhost:5000/api/ai/forecast/ensemble/MAT001?periodos=30" \
  -H "Authorization: Bearer <token>"

# Ensemble con modelos específicos
curl -X GET "http://localhost:5000/api/ai/forecast/ensemble/MAT001?periodos=60&modelos=random_forest,xgboost,gradient_boosting&centro=1000" \
  -H "Authorization: Bearer <token>"
```

### Frontend

```jsx
import EnsembleChart from '../components/forecast/EnsembleChart';

function ForecastPage() {
  const [ensembleData, setEnsembleData] = useState(null);
  const [individualData, setIndividualData] = useState([]);

  useEffect(() => {
    // Llamar al endpoint
    fetch(`/api/ai/forecast/ensemble/MAT001?periodos=30`)
      .then(res => res.json())
      .then(data => {
        setEnsembleData(data.data.ensemble);
        setIndividualData(data.data.individuales);
      });
  }, []);

  return (
    <EnsembleChart
      ensembleData={ensembleData}
      individualData={individualData}
      weights={ensembleData?.pesos}
      metricas={ensembleData?.metricas}
      height={500}
      showTable={true}
    />
  );
}
```

## Métricas de Rendimiento

### Tests

- **11 tests** en `test_ensemble_forecast.py`
- **Tiempo de ejecución**: 45.32 segundos
- **Estado**: ✅ Todos pasando
- **Warnings**: 2 (deprecation warnings no relacionados)

### Modelos Soportados

Por defecto, el ensemble usa:
- `random_forest` (siempre disponible)
- `gradient_boosting` (siempre disponible)
- `linear` (Ridge, siempre disponible)
- `xgboost` (si está instalado)
- `arima` (si está instalado)
- `prophet` (si está instalado)

**NO incluye por defecto** (muy lentos):
- `lstm` (requiere TensorFlow, muy lento)
- `stl` (descomposición STL, muy lento)
- `ensemble` (evitar recursión)

## Mejoras Futuras

1. **Cache de modelos entrenados**: Persistir ensemble entrenados para reutilización
2. **Auto-selección de modelos**: Usar solo los N mejores modelos según backtesting
3. **Pesos dinámicos**: Ajustar pesos según horizonte de predicción
4. **Stacking**: Implementar stacking (meta-modelo) en lugar de weighted averaging
5. **Visualización interactiva**: Permitir toggle de modelos individuales en el gráfico
6. **Comparación vs modelo simple**: Mostrar ganancia del ensemble vs mejor modelo individual

## Integración con Sistema Existente

- ✅ Compatible con `ForecastStrategy` base
- ✅ Registrado en factory de estrategias
- ✅ Disponible vía `obtener_estrategia('ensemble')`
- ✅ Incluido en `obtener_estrategias_disponibles()`
- ✅ Soporta backtesting vía `Backtester`
- ✅ Soporta tuning vía `HyperparameterTuner` (para sub-modelos)
- ✅ Endpoint REST con autenticación y rate limiting
- ✅ Frontend component con i18n support

## Notas de Implementación

1. **Thread Safety**: ThreadPoolExecutor asegura thread safety en entrenamiento/predicción paralelos
2. **Fallback**: Si todos los modelos fallan, usa predicción simple (modelo base)
3. **Pesos manuales**: Soporta pesos manuales si se proveen en constructor
4. **Feature importance**: Agrega importances de todos los modelos ponderados por peso
5. **Validación**: Valida datos mínimos antes de entrenar (min 5 registros)
6. **Error handling**: Captura errores de modelos individuales sin interrumpir el ensemble
7. **Logging**: Log detallado de proceso de entrenamiento y errores

## Documentación i18n

Claves i18n utilizadas en `EnsembleChart.jsx`:

```javascript
forecast_ensemble_sin_datos: 'Sin datos de ensemble para mostrar'
forecast_ensemble_titulo: 'Predicción Ensemble'
forecast_ensemble_modelos: 'modelos'
forecast_ensemble_hint: 'Combinación ponderada de múltiples modelos de pronóstico'
forecast_ensemble_intervalo: 'Intervalo de Confianza'
forecast_ensemble_prediccion: 'Ensemble'
forecast_ensemble_pesos_metricas: 'Pesos y Métricas de Modelos'
forecast_ensemble_modelo: 'Modelo'
forecast_ensemble_peso: 'Peso'
forecast_ensemble_total: 'Ensemble Total'
```

## Estado del Sprint

- ✅ Backend: EnsembleStrategy implementado
- ✅ Backend: Endpoint /api/ai/forecast/ensemble/<material>
- ✅ Backend: Registrado en __init__.py
- ✅ Frontend: EnsembleChart.jsx creado
- ✅ Tests: 11 tests unitarios pasando
- ✅ Documentación: Este documento

**Sprint 38 completado exitosamente.**
