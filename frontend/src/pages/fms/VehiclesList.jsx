import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import {
  Plus,
  Truck,
  Search,
  LayoutGrid,
  List,
  Gauge,
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useFmsStore } from '../../store/fmsStore'

const ESTADO_COLORS = {
  disponible: 'success',
  en_ruta: 'primary',
  en_mantenimiento: 'warning',
  fuera_servicio: 'error',
  baja: 'default',
}

const ESTADO_LABELS = {
  disponible: 'Disponible',
  en_ruta: 'En Ruta',
  en_mantenimiento: 'En Mantenimiento',
  fuera_servicio: 'Fuera de Servicio',
  baja: 'Baja',
}

const TIPOS_VEHICULO = [
  { value: '', label: 'Todos los tipos' },
  { value: 'camion', label: 'Camion' },
  { value: 'camioneta', label: 'Camioneta' },
  { value: 'vehiculo_ligero', label: 'Vehiculo Ligero' },
  { value: 'montacargas', label: 'Montacargas' },
  { value: 'grua', label: 'Grua' },
]

export default function VehiclesList() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { vehicles, vehiclesLoading, error, fetchVehicles } = useFmsStore()

  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  const handleSearch = useCallback(() => {
    const params = {}
    if (filtroEstado) params.estado = filtroEstado
    if (filtroTipo) params.tipo = filtroTipo
    if (searchText) params.q = searchText
    fetchVehicles(params)
  }, [filtroEstado, filtroTipo, searchText, fetchVehicles])

  useEffect(() => {
    const timer = setTimeout(handleSearch, 400)
    return () => clearTimeout(timer)
  }, [filtroEstado, filtroTipo, searchText, handleSearch])

  const handleRowClick = (id) => {
    navigate(`/fms/vehicles/${id}`)
  }

  const filteredVehicles = vehicles || []

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {t('fms_vehicles_title', 'Flota de Vehiculos')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fms_vehicles_subtitle', 'Gestion y monitoreo de vehiculos')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus />}
          onClick={() => navigate('/fms/vehicles/new')}
        >
          {t('fms_new_vehicle', 'Nuevo Vehiculo')}
        </Button>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('fms_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filtroEstado}
              label={t('fms_filter_estado', 'Estado')}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('fms_filter_tipo', 'Tipo')}</InputLabel>
            <Select
              value={filtroTipo}
              label={t('fms_filter_tipo', 'Tipo')}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              {TIPOS_VEHICULO.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder={t('fms_search_placeholder', 'Buscar por placa, marca...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ flexGrow: 1 }}
          />

          <Stack direction="row" spacing={0.5}>
            <IconButton
              color={viewMode === 'grid' ? 'primary' : 'default'}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid />
            </IconButton>
            <IconButton
              color={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')}
            >
              <List />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Loading */}
      {vehiclesLoading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!vehiclesLoading && filteredVehicles.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Truck sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            {t('fms_no_vehicles', 'No se encontraron vehiculos')}
          </Typography>
        </Paper>
      )}

      {/* Grid View */}
      {!vehiclesLoading && filteredVehicles.length > 0 && viewMode === 'grid' && (
        <Grid container spacing={2}>
          {filteredVehicles.map((v) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={v.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 6 },
                }}
                onClick={() => handleRowClick(v.id)}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="h6" fontWeight={600}>{v.placa}</Typography>
                    <Chip
                      label={ESTADO_LABELS[v.estado] || v.estado}
                      color={ESTADO_COLORS[v.estado] || 'default'}
                      size="small"
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {v.tipo ? v.tipo.replace(/_/g, ' ') : '--'}
                  </Typography>
                  <Typography variant="body2">
                    {v.marca} {v.modelo}
                  </Typography>
                  {v.capacidad_kg && (
                    <Typography variant="caption" color="text.secondary">
                      Capacidad: {Number(v.capacidad_kg).toLocaleString()} kg
                    </Typography>
                  )}
                  <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
                    <Gauge sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {v.odometro_actual ? `${Number(v.odometro_actual).toLocaleString()} km` : 'Sin datos'}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Table View */}
      {!vehiclesLoading && filteredVehicles.length > 0 && viewMode === 'table' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Placa</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Marca / Modelo</TableCell>
                <TableCell align="right">Capacidad (kg)</TableCell>
                <TableCell align="right">Odometro</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredVehicles.map((v) => (
                <TableRow
                  key={v.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(v.id)}
                >
                  <TableCell>
                    <Typography fontWeight={600}>{v.placa}</Typography>
                  </TableCell>
                  <TableCell>{v.tipo ? v.tipo.replace(/_/g, ' ') : '--'}</TableCell>
                  <TableCell>{v.marca} {v.modelo}</TableCell>
                  <TableCell align="right">
                    {v.capacidad_kg ? Number(v.capacidad_kg).toLocaleString() : '--'}
                  </TableCell>
                  <TableCell align="right">
                    {v.odometro_actual ? `${Number(v.odometro_actual).toLocaleString()} km` : '--'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ESTADO_LABELS[v.estado] || v.estado}
                      color={ESTADO_COLORS[v.estado] || 'default'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
