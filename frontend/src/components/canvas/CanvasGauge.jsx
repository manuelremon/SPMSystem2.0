/**
 * Canvas-based Gauge Component
 *
 * Migrado de implementación Canvas nativa a Chart.js via SPMGauge.
 * Mantiene la API original para compatibilidad hacia atrás.
 *
 * Uso:
 *   <CanvasGauge
 *     value={75}
 *     valueMax={100}
 *     width={70}
 *     height={70}
 *     color="var(--primary)"
 *     text="75%"
 *   />
 */

import React from 'react';
import { SPMGauge } from '../ui/SPMChartJS';

export function CanvasGauge({
  value = 0,
  valueMax = 100,
  width = 70,
  height = 70,
  color = 'var(--primary)',
  backgroundColor = 'var(--border)',
  text,
}) {
  // SPMGauge usa height para dimensionar (width es ignorado)
  // Usamos el menor entre width y height para mantener aspecto cuadrado
  const size = Math.min(width, height);

  // Extraer unidad del texto si existe, o usar '%' por defecto
  const unit = text ? '' : '%';

  return (
    <SPMGauge
      value={value}
      valueMax={valueMax}
      height={size}
      width={size}
      color={color}
      unit={unit}
      showText={true}
    />
  );
}

export default CanvasGauge;
