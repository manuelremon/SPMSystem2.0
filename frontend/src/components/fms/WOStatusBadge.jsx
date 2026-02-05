/**
 * WOStatusBadge - Badge for Work Order FSM states
 */
import React from 'react'
import { Chip } from '@mui/material'

const WO_STATE_CONFIG = {
  draft: { label: 'Borrador', color: 'default' },
  approved: { label: 'Aprobada', color: 'info' },
  in_progress: { label: 'En Progreso', color: 'primary' },
  pending_parts: { label: 'Espera Repuestos', color: 'warning' },
  completed: { label: 'Completada', color: 'success' },
  closed: { label: 'Cerrada', color: 'secondary' },
  cancelled: { label: 'Cancelada', color: 'error' },
}

export default function WOStatusBadge({ estado, size = 'small', ...props }) {
  const config = WO_STATE_CONFIG[estado] || { label: estado, color: 'default' }
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
