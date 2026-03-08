import { useEffect, useMemo, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import { useI18n } from '../../context/i18n'
import { useFmsStore, useFmsVehicles, useFmsLoading } from '../../store/fmsStore'
import { SPMAgGrid } from '../../components/ui/SPMAgGrid'

const ESTADO_COLORS = {
  disponible: 'success',
  en_ruta: 'primary',
  en_mantenimiento: 'warning',
  mantenimiento: 'warning',
  fuera_servicio: 'error',
  baja: 'default',
}

const ESTADO_LABELS = {
  disponible: 'Disponible',
  en_ruta: 'En Ruta',
  en_mantenimiento: 'En Mantenimiento',
  mantenimiento: 'En Mantenimiento',
  fuera_servicio: 'Fuera de Servicio',
  baja: 'Baja',
}

const TIPOS_VEHICULO = [
  { value: '', label: 'Todos los tipos' },
  { value: 'camion', label: 'Camión' },
  { value: 'camioneta', label: 'Camioneta' },
  { value: 'furgon', label: 'Furgón' },
  { value: 'semirremolque', label: 'Semirremolque' },
  { value: 'vehiculo_ligero', label: 'Vehículo Ligero' },
  { value: 'montacargas', label: 'Montacargas' },
  { value: 'grua', label: 'Grúa' },
]

export default function VehiclesList() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const vehicles = useFmsVehicles()
  const vehiclesLoading = useFmsLoading()
  const error = useFmsStore(s => s.error)
  const fetchVehicles = useFmsStore(s => s.fetchVehicles)

  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  const handleFilterChange = useCallback(() => {
    const params = {}
    if (filtroEstado) params.estado = filtroEstado
    if (filtroTipo) params.tipo = filtroTipo
    fetchVehicles(params)
  }, [filtroEstado, filtroTipo, fetchVehicles])

  useEffect(() => {
    const timer = setTimeout(handleFilterChange, 300)
    return () => clearTimeout(timer)
  }, [filtroEstado, filtroTipo, handleFilterChange])

  const columnDefs = useMemo(() => [
    {
      field: 'codigo',
      headerName: t('fms_col_codigo', 'Código'),
      flex: 0.4,
      minWidth: 100,
      cellRenderer: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'patente',
      headerName: t('fms_col_patente', 'Patente'),
      flex: 0.5,
      minWidth: 110,
      cellRenderer: (params) => (
        <Typography variant="body2" fontWeight={600}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'tipo',
      headerName: t('fms_col_tipo', 'Tipo'),
      flex: 0.5,
      minWidth: 120,
      valueFormatter: (params) => params.value ? params.value.replace(/_/g, ' ') : '--',
    },
    {
      field: 'marca',
      headerName: t('fms_col_marca', 'Marca'),
      flex: 0.5,
      minWidth: 120,
    },
    {
      field: 'modelo',
      headerName: t('fms_col_modelo', 'Modelo'),
      flex: 0.6,
      minWidth: 130,
    },
    {
      field: 'anio',
      headerName: t('fms_col_anio', 'Año'),
      flex: 0.3,
      minWidth: 70,
    },
    {
      field: 'capacidad_kg',
      headerName: t('fms_col_capacidad', 'Capacidad (kg)'),
      flex: 0.5,
      minWidth: 120,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? Number(params.value).toLocaleString() : '--',
    },
    {
      field: 'km_actual',
      headerName: t('fms_col_km', 'Km Actual'),
      flex: 0.5,
      minWidth: 110,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? `${Number(params.value).toLocaleString()} km` : '--',
    },
    {
      field: 'estado',
      headerName: t('fms_col_estado', 'Estado'),
      flex: 0.5,
      minWidth: 140,
      cellRenderer: (params) => (
        <Chip
          label={ESTADO_LABELS[params.value] || params.value || '--'}
          color={ESTADO_COLORS[params.value] || 'default'}
          size="small"
          sx={{
            fontSize: '0.625rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            height: 20,
          }}
        />
      ),
    },
  ], [t])

  const handleRowClick = useCallback((event) => {
    if (event.data?.id) {
      navigate(`/fms/vehicles/${event.data.id}`)
    }
  }, [navigate])

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('fms_vehicles_title', 'Flota de Vehículos')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fms_vehicles_subtitle', 'Gestión y monitoreo de vehículos')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate('/fms/vehicles/new')}
          sx={{ textTransform: 'none' }}
        >
          {t('fms_new_vehicle', 'Nuevo Vehículo')}
        </Button>
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('fms_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filtroEstado}
              label={t('fms_filter_estado', 'Estado')}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <MenuItem value="">{t('fms_filter_todos', 'Todos')}</MenuItem>
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
              {TIPOS_VEHICULO.map((tipo) => (
                <MenuItem key={tipo.value} value={tipo.value}>{tipo.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Error */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Grid */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <SPMAgGrid
          rowData={vehicles || []}
          columnDefs={columnDefs}
          loading={vehiclesLoading}
          height={560}
          enableQuickFilter={true}
          exportFileName="flota_vehiculos"
          emptyMessage={t('fms_no_vehicles', 'No se encontraron vehículos')}
          onRowClicked={handleRowClick}
          gridOptions={{
            rowStyle: { cursor: 'pointer' },
          }}
        />
      </Paper>
      </Box>
    </Box>
  )
}
