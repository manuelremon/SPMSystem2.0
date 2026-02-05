/**
 * Lazy-loaded Forecast Components
 *
 * Estos componentes se cargan dinámicamente para reducir el bundle inicial.
 * Solo se cargan cuando el usuario navega a Forecast o Masivo.
 *
 * Esto permite que Chart.js solo se incluya cuando sea necesario.
 */

import React, { lazy, Suspense } from 'react'
import Loading from '../Loading'

// Lazy load chart-heavy components
export const ForecastKPIs = lazy(() =>
  import('./ForecastKPIs').then(module => ({ default: module.ForecastKPIs }))
)

export const ModelSelector = lazy(() =>
  import('./ModelSelector').then(module => ({ default: module.ModelSelector }))
)

export const ForecastChart = lazy(() =>
  import('./ForecastChart').then(module => ({ default: module.ForecastChart }))
)

export const BacktestResults = lazy(() =>
  import('./BacktestResults').then(module => ({ default: module.BacktestResults }))
)

export const ModelComparison = lazy(() =>
  import('./ModelComparison').then(module => ({ default: module.ModelComparison }))
)

export const PatternCharts = lazy(() =>
  import('./PatternCharts').then(module => ({ default: module.PatternCharts }))
)

/**
 * Wrapper component con Suspense para lazy-loaded components
 */
export function LazyComponent({ component: Component, ...props }) {
  return (
    <Suspense fallback={<Loading />}>
      <Component {...props} />
    </Suspense>
  )
}

export default {
  ForecastKPIs,
  ModelSelector,
  ForecastChart,
  BacktestResults,
  ModelComparison,
  PatternCharts,
  LazyComponent,
}
