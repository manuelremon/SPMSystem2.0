/**
 * ShipmentTimeline - Visual timeline of tracking events
 */
import React from 'react'
import { Box, Typography, Paper, Chip } from '@mui/material'
import { MapPin, Fuel, AlertTriangle, Package, Clock, Truck, CheckCircle2 } from '../ui/Icons'

const EVENT_ICONS = {
  salida: Truck,
  parada: Clock,
  carga_combustible: Fuel,
  checkpoint: MapPin,
  incidencia: AlertTriangle,
  entrega_parcial: Package,
  entrega: CheckCircle2,
  posicion: MapPin,
  otro: Clock,
}

const EVENT_COLORS = {
  salida: 'var(--info)',
  parada: 'var(--warning-light)',
  carga_combustible: 'var(--success)',
  checkpoint: 'var(--purple-dark)',
  incidencia: 'var(--danger-light)',
  entrega_parcial: 'var(--warning-light)',
  entrega: 'var(--success)',
  posicion: 'var(--neutral)',
  otro: 'var(--fg-subtle)',
}

export default function ShipmentTimeline({ events = [] }) {
  if (!events.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <Typography>No hay eventos de tracking registrados</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative', pl: 4 }}>
      {/* Vertical line */}
      <Box sx={{
        position: 'absolute', left: 15, top: 0, bottom: 0,
        width: 2, bgcolor: 'divider',
      }} />

      {events.map((event, idx) => {
        const Icon = EVENT_ICONS[event.evento_tipo] || Clock
        const color = EVENT_COLORS[event.evento_tipo] || 'var(--fg-subtle)'
        const date = event.created_at ? new Date(event.created_at) : null

        return (
          <Box key={event.id || idx} sx={{ position: 'relative', mb: 3 }}>
            {/* Dot */}
            <Box sx={{
              position: 'absolute', left: -25, top: 4,
              width: 24, height: 24, borderRadius: '50%',
              bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1,
            }}>
              <Icon size={14} color="white" />
            </Box>

            <Paper sx={{ p: 2, ml: 1 }} variant="outlined">
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Chip
                  label={event.evento_tipo?.replace('_', ' ')?.toUpperCase()}
                  size="small"
                  sx={{ bgcolor: color, color: 'white', fontWeight: 600, fontSize: '0.7rem' }}
                />
                {date && (
                  <Typography variant="caption" color="text.secondary">
                    {date.toLocaleDateString('es-MX')} {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                )}
              </Box>

              {event.ubicacion_nombre && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {event.ubicacion_nombre}
                </Typography>
              )}

              {event.notas && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {event.notas}
                </Typography>
              )}

              {event.temperatura != null && (
                <Typography variant="caption" color="text.secondary">
                  Temp: {event.temperatura}°C
                </Typography>
              )}
            </Paper>
          </Box>
        )
      })}
    </Box>
  )
}
