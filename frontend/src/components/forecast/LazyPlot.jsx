/**
 * LazyPlot - Wrapper con lazy loading para react-plotly.js
 *
 * Reduce el bundle inicial en ~3MB cargando Plotly solo cuando se necesita
 */

import React, { lazy, Suspense } from 'react';

// Lazy load Plotly.js (solo se carga cuando el componente se renderiza)
const Plot = lazy(() => import('react-plotly.js'));

// Loading placeholder mientras carga Plotly
const PlotLoading = ({ height = 400 }) => (
  <div
    className="flex items-center justify-center bg-neutral-50 rounded-lg animate-pulse"
    style={{ height }}
  >
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
      <span className="text-sm text-neutral-500">Cargando grafico...</span>
    </div>
  </div>
);

/**
 * Wrapper con Suspense para react-plotly.js
 *
 * Props: mismas que react-plotly.js Plot component
 */
const LazyPlot = ({ layout, ...props }) => {
  // Extraer height del layout para el placeholder
  const height = layout?.height || 400;

  return (
    <Suspense fallback={<PlotLoading height={height} />}>
      <Plot layout={layout} {...props} />
    </Suspense>
  );
};

export default LazyPlot;
