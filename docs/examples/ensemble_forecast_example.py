"""
Ejemplo de uso de EnsembleStrategy para predicción de demanda

Este script demuestra cómo usar el ensemble de modelos para generar
predicciones más robustas combinando múltiples algoritmos.
"""

import pandas as pd
from datetime import datetime, timedelta

from backend.agent.pipelines.forecast import (
    EnsembleStrategy,
    RandomForestStrategy,
    GradientBoostingStrategy,
    RidgeStrategy,
    obtener_estrategia,
    obtener_estrategias_disponibles
)


def ejemplo_basico():
    """Ejemplo básico de ensemble con 3 modelos"""
    print("=" * 60)
    print("Ejemplo 1: Ensemble Básico")
    print("=" * 60)

    # Crear datos sintéticos
    dates = pd.date_range('2024-01-01', periods=120, freq='D')
    cantidad = 100 + pd.Series(range(120)) * 0.5  # Tendencia
    cantidad += pd.Series([10 * (i % 7 == 0) for i in range(120)])  # Pico semanal
    cantidad += pd.Series(pd.np.random.randn(120) * 5)  # Ruido

    df = pd.DataFrame({
        'fecha': dates,
        'cantidad': cantidad.clip(lower=0)
    })

    print(f"\nDatos de entrenamiento: {len(df)} registros")
    print(f"Período: {df['fecha'].min()} a {df['fecha'].max()}")
    print(f"Demanda promedio: {df['cantidad'].mean():.2f}")

    # Crear estrategias
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
        RidgeStrategy()
    ]

    # Crear ensemble
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar
    print("\nEntrenando ensemble...")
    metricas = ensemble.entrenar(df)

    print(f"\nMétricas del ensemble:")
    print(f"  MAE:  {metricas['mae']:.2f}")
    print(f"  RMSE: {metricas['rmse']:.2f}")
    print(f"  R²:   {metricas['r2']:.3f}")
    print(f"  MAPE: {metricas['mape']:.2f}%")

    # Pesos de los modelos
    pesos = ensemble.get_weights()
    print(f"\nPesos de los modelos:")
    for modelo, peso in sorted(pesos.items(), key=lambda x: x[1], reverse=True):
        print(f"  {modelo}: {peso:.3f} ({peso*100:.1f}%)")

    # Predecir
    print("\nGenerando predicciones para 30 días...")
    predicciones = ensemble.predecir(df, periodos=30)

    print(f"\nPrimeras 5 predicciones:")
    for i in range(5):
        pred = predicciones.iloc[i]
        print(f"  {pred['fecha'].strftime('%Y-%m-%d')}: "
              f"{pred['prediccion']:.1f} "
              f"[{pred['limite_inferior']:.1f} - {pred['limite_superior']:.1f}]")

    return ensemble, predicciones


def ejemplo_con_pesos_manuales():
    """Ejemplo de ensemble con pesos manuales"""
    print("\n" + "=" * 60)
    print("Ejemplo 2: Ensemble con Pesos Manuales")
    print("=" * 60)

    # Datos sintéticos
    dates = pd.date_range('2024-01-01', periods=90, freq='D')
    cantidad = 50 + pd.Series(pd.np.random.randn(90) * 10).clip(lower=0)

    df = pd.DataFrame({'fecha': dates, 'cantidad': cantidad})

    # Crear estrategias con pesos manuales
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
    ]
    manual_weights = [0.7, 0.3]  # 70% Random Forest, 30% Gradient Boosting

    ensemble = EnsembleStrategy(strategies=strategies, weights=manual_weights)

    print("\nPesos manuales configurados:")
    for strategy, peso in zip(strategies, manual_weights):
        print(f"  {strategy.nombre_modelo}: {peso:.1%}")

    # Entrenar
    metricas = ensemble.entrenar(df)

    # Verificar pesos
    pesos = ensemble.get_weights()
    print("\nPesos finales (normalizados):")
    for modelo, peso in pesos.items():
        print(f"  {modelo}: {peso:.3f}")

    return ensemble


def ejemplo_comparacion_modelos():
    """Ejemplo de comparación de predicciones individuales vs ensemble"""
    print("\n" + "=" * 60)
    print("Ejemplo 3: Comparación Individual vs Ensemble")
    print("=" * 60)

    # Datos sintéticos con estacionalidad
    dates = pd.date_range('2024-01-01', periods=100, freq='D')
    cantidad = 80 + pd.Series([15 * pd.np.sin(i * 0.1) for i in range(100)])
    cantidad += pd.Series(pd.np.random.randn(100) * 8)
    cantidad = cantidad.clip(lower=0)

    df = pd.DataFrame({'fecha': dates, 'cantidad': cantidad})

    # Crear ensemble
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
        RidgeStrategy()
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar
    ensemble.entrenar(df)

    # Obtener predicciones individuales
    print("\nGenerando predicciones para 10 días...")
    pred_individuales = ensemble.get_individual_predictions(df, periodos=10)
    pred_ensemble = ensemble.predecir(df, periodos=10)

    # Comparar primera predicción
    print("\nComparación para el día 1:")
    fecha = pred_ensemble.iloc[0]['fecha']
    print(f"Fecha: {fecha.strftime('%Y-%m-%d')}")

    for modelo, preds in pred_individuales.items():
        pred_val = preds.iloc[0]['prediccion']
        peso = ensemble.get_weights()[modelo]
        print(f"  {modelo}: {pred_val:.2f} (peso: {peso:.2%})")

    ensemble_val = pred_ensemble.iloc[0]['prediccion']
    print(f"\n  Ensemble: {ensemble_val:.2f}")

    # Calcular promedio simple para comparación
    promedio_simple = sum(
        preds.iloc[0]['prediccion'] for preds in pred_individuales.values()
    ) / len(pred_individuales)

    print(f"  Promedio simple: {promedio_simple:.2f}")
    print(f"  Diferencia: {ensemble_val - promedio_simple:.2f}")

    return ensemble, pred_individuales, pred_ensemble


def ejemplo_feature_importance():
    """Ejemplo de feature importance agregado"""
    print("\n" + "=" * 60)
    print("Ejemplo 4: Feature Importance del Ensemble")
    print("=" * 60)

    # Datos sintéticos
    dates = pd.date_range('2024-01-01', periods=150, freq='D')
    cantidad = 60 + pd.Series(pd.np.random.randn(150) * 12).clip(lower=0)

    df = pd.DataFrame({'fecha': dates, 'cantidad': cantidad})

    # Crear ensemble con modelos que proveen feature importance
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar
    ensemble.entrenar(df)

    # Obtener feature importance agregado
    importance = ensemble.get_feature_importance()

    print("\nTop 10 features más importantes (agregadas):")
    print(f"{'Feature':<30} {'Importance':<10}")
    print("-" * 40)

    for i in range(min(10, len(importance))):
        row = importance.iloc[i]
        print(f"{row['feature']:<30} {row['importance']:<10.4f}")

    return ensemble, importance


def ejemplo_uso_factory():
    """Ejemplo usando el factory pattern"""
    print("\n" + "=" * 60)
    print("Ejemplo 5: Uso del Factory Pattern")
    print("=" * 60)

    # Listar estrategias disponibles
    disponibles = obtener_estrategias_disponibles()
    print(f"\nEstrategias disponibles: {', '.join(disponibles)}")

    # Crear ensemble dinámicamente con todas las disponibles
    # (excluyendo ensemble para evitar recursión)
    modelos_para_ensemble = [m for m in disponibles if m not in ['ensemble', 'lstm', 'stl']]

    print(f"\nCreando ensemble con: {', '.join(modelos_para_ensemble)}")

    strategies = []
    for modelo_id in modelos_para_ensemble:
        estrategia = obtener_estrategia(modelo_id)
        if estrategia:
            strategies.append(estrategia)

    ensemble = EnsembleStrategy(strategies=strategies)

    print(f"\nEnsemble creado con {len(strategies)} modelos")
    print(f"Nombre: {ensemble.nombre_modelo}")

    return ensemble


def ejemplo_completo_workflow():
    """Workflow completo: entrenar, predecir, evaluar"""
    print("\n" + "=" * 60)
    print("Ejemplo 6: Workflow Completo")
    print("=" * 60)

    # 1. Preparar datos
    print("\n1. Preparando datos...")
    dates = pd.date_range('2024-01-01', periods=200, freq='D')
    tendencia = pd.Series(range(200)) * 0.3
    estacionalidad = pd.Series([20 * pd.np.sin(i * 0.05) for i in range(200)])
    ruido = pd.Series(pd.np.random.randn(200) * 8)
    cantidad = (100 + tendencia + estacionalidad + ruido).clip(lower=0)

    df = pd.DataFrame({'fecha': dates, 'cantidad': cantidad})

    # Split train/test
    train_size = int(len(df) * 0.8)
    df_train = df.iloc[:train_size]
    df_test = df.iloc[train_size:]

    print(f"  Train: {len(df_train)} registros")
    print(f"  Test:  {len(df_test)} registros")

    # 2. Crear y entrenar ensemble
    print("\n2. Entrenando ensemble...")
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
        RidgeStrategy()
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    metricas_train = ensemble.entrenar(df_train)
    print(f"  Métricas de entrenamiento: MAPE={metricas_train['mape']:.2f}%")

    # 3. Generar predicciones
    print("\n3. Generando predicciones...")
    predicciones = ensemble.predecir(df_train, periodos=len(df_test))

    # 4. Evaluar en test set
    print("\n4. Evaluando en test set...")
    y_true = df_test['cantidad'].values
    y_pred = predicciones['prediccion'].values[:len(y_true)]

    from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error

    mae_test = mean_absolute_error(y_true, y_pred)
    mape_test = mean_absolute_percentage_error(y_true, y_pred) * 100

    print(f"  MAE en test:  {mae_test:.2f}")
    print(f"  MAPE en test: {mape_test:.2f}%")

    # 5. Comparar con modelos individuales
    print("\n5. Comparando con modelos individuales...")
    pred_individuales = ensemble.get_individual_predictions(df_train, periodos=len(df_test))

    for modelo, preds in pred_individuales.items():
        y_pred_modelo = preds['prediccion'].values[:len(y_true)]
        mape_modelo = mean_absolute_percentage_error(y_true, y_pred_modelo) * 100
        mejora = mape_modelo - mape_test
        print(f"  {modelo}: MAPE={mape_modelo:.2f}% "
              f"(ensemble {mejora:+.2f}% mejor)" if mejora > 0 else f"({mejora:.2f}% peor)")

    return ensemble, predicciones, df_train, df_test


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Ejemplos de Uso de EnsembleStrategy")
    print("=" * 60)

    # Ejecutar ejemplos
    try:
        ejemplo_basico()
        ejemplo_con_pesos_manuales()
        ejemplo_comparacion_modelos()
        ejemplo_feature_importance()
        ejemplo_uso_factory()
        ejemplo_completo_workflow()

        print("\n" + "=" * 60)
        print("Todos los ejemplos completados exitosamente!")
        print("=" * 60 + "\n")

    except Exception as e:
        print(f"\nError ejecutando ejemplos: {e}")
        import traceback
        traceback.print_exc()
