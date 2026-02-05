/**
 * ShipmentFSMBadge - Visual badge for shipment FSM states
 */
import React from 'react'
import { Chip } from '@mui/material'

const STATE_CONFIG = {
  draft: { label: 'Borrador', color: 'default' },
  confirmed: { label: 'Confirmado', color: 'info' },
  assigned: { label: 'Asignado', color: 'warning' },
  in_transit: { label: 'En Transito', color: 'primary' },
  delivered: { label: 'Entregado', color: 'success' },
  incident: { label: 'Incidencia', color: 'error' },
  resolved: { label: 'Resuelto', color: 'info' },
  settled: { label: 'Liquidado', color: 'secondary' },
  closed: { label: 'Cerrado', color: 'default' },
  cancelled: { label: 'Cancelado', color: 'error' },
}

export default function ShipmentFSMBadge({ estado, size = 'small', ...props }) {
  const config = STATE_CONFIG[estado] || { label: estado, color: 'default' }
  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      variant="filled"
      {...props}
    />
  )
}
