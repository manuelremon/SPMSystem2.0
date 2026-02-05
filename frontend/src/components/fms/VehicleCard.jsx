/**
 * VehicleCard - Card display for a vehicle in the fleet
 */
import React from 'react'
import { Card, CardContent, CardActionArea, Box, Typography, Chip, LinearProgress } from '@mui/material'
import { Truck, Fuel, Gauge } from '../ui/Icons'

const STATUS_CONFIG = {
  disponible: { label: 'Disponible', color: 'success' },
  en_ruta: { label: 'En Ruta', color: 'primary' },
  en_mantenimiento: { label: 'En Mantenimiento', color: 'warning' },
  fuera_servicio: { label: 'Fuera de Servicio', color: 'error' },
  baja: { label: 'Baja', color: 'default' },
}

const TYPE_LABELS = {
  camion: 'Camion',
  camioneta: 'Camioneta',
  trailer: 'Trailer',
  van: 'Van',
  rabon: 'Rabon',
  torton: 'Torton',
  pipa: 'Pipa',
  otro: 'Otro',
}

export default function VehicleCard({ vehicle, onClick }) {
  const status = STATUS_CONFIG[vehicle.estado] || STATUS_CONFIG.disponible

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                {vehicle.placa}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {vehicle.numero_economico || ''} {vehicle.marca} {vehicle.modelo} {vehicle.anio || ''}
              </Typography>
            </Box>
            <Chip label={status.label} color={status.color} size="small" />
          </Box>

          {/* Type */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Truck size={14} />
            <Typography variant="body2">{TYPE_LABELS[vehicle.tipo] || vehicle.tipo}</Typography>
          </Box>

          {/* Capacity */}
          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Peso: {(vehicle.capacidad_peso_kg || 0).toLocaleString()} kg
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Vol: {(vehicle.capacidad_vol_m3 || 0).toFixed(1)} m3
            </Typography>
          </Box>

          {/* Odometer */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Gauge size={14} />
            <Typography variant="caption">
              {(vehicle.odometro_actual || 0).toLocaleString()} km
            </Typography>
          </Box>

          {/* Fuel efficiency */}
          {vehicle.rendimiento_km_lt > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Fuel size={14} />
              <Typography variant="caption">
                {vehicle.rendimiento_km_lt} km/lt ({vehicle.tipo_combustible})
              </Typography>
            </Box>
          )}

          {/* Special capabilities */}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
            {vehicle.cadena_frio ? <Chip label="Frio" size="small" color="info" variant="outlined" sx={{ fontSize: '0.65rem' }} /> : null}
            {vehicle.hazmat_cert ? <Chip label="Hazmat" size="small" color="error" variant="outlined" sx={{ fontSize: '0.65rem' }} /> : null}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
