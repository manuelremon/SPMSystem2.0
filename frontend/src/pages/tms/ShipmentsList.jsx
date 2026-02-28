import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Chip, IconButton, TablePagination, CircularProgress
} from '@mui/material'
import { Plus, Eye, Truck, Search } from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore, useTmsShipments, useTmsLoading } from '../../store/tmsStore'

const ESTADO_COLORS = {
  draft: 'default',
  confirmed: 'info',
  assigned: 'warning',
  in_transit: 'primary',
  delivered: 'success',
  incident: 'error',
  settled: 'secondary',
  cancelled: 'error',
}

const ESTADO_LABELS = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  assigned: 'Asignado',
  in_transit: 'En Transito',
  delivered: 'Entregado',
  incident: 'Incidente',
  settled: 'Liquidado',
  cancelled: 'Cancelado',
}

const PRIORIDAD_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: '1', label: '1 - Muy Baja' },
  { value: '2', label: '2 - Baja' },
  { value: '3', label: '3 - Media' },
  { value: '4', label: '4 - Alta' },
  { value: '5', label: '5 - Urgente' },
]

export default function ShipmentsList() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const shipments = useTmsShipments()
  const shipmentsTotal = useTmsStore(s => s.shipmentsTotal)
  const shipmentsLoading = useTmsLoading()
  const fetchShipments = useTmsStore(s => s.fetchShipments)

  const [filters, setFilters] = useState({
    estado: '',
    prioridad: '',
    search: '',
  })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  useEffect(() => {
    const params = { page: page + 1, per_page: rowsPerPage }
    if (filters.estado) params.estado = filters.estado
    if (filters.prioridad) params.prioridad = filters.prioridad
    if (filters.search) params.search = filters.search
    fetchShipments(params)
  }, [page, rowsPerPage, filters, fetchShipments])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setPage(0)
  }

  const handleChangePage = (_event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleRowClick = (id) => {
    navigate(`/tms/shipments/${id}`)
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Truck sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={600}>
            {t('tms_shipments_title', 'Envios')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus />}
          onClick={() => navigate('/tms/shipments/new')}
        >
          {t('tms_new_shipment', 'Nuevo Envio')}
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('tms_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('tms_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              <MenuItem value="">{t('common_all', 'Todos')}</MenuItem>
              {Object.entries(ESTADO_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('tms_filter_prioridad', 'Prioridad')}</InputLabel>
            <Select
              value={filters.prioridad}
              label={t('tms_filter_prioridad', 'Prioridad')}
              onChange={(e) => handleFilterChange('prioridad', e.target.value)}
            >
              {PRIORIDAD_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder={t('tms_search_placeholder', 'Buscar por codigo, origen o destino...')}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
            sx={{ minWidth: 300 }}
          />
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        {shipmentsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_col_codigo', 'Codigo')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_col_tipo', 'Tipo')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_col_estado', 'Estado')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_col_origen', 'Origen')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_col_destino', 'Destino')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_col_prioridad', 'Prioridad')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_col_fecha_prog', 'Fecha Prog.')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">{t('tms_col_acciones', 'Acciones')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {t('tms_no_shipments', 'No se encontraron envios')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  shipments.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(shipment.id)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {shipment.codigo || `ENV-${shipment.id}`}
                        </Typography>
                      </TableCell>
                      <TableCell>{shipment.tipo || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={ESTADO_LABELS[shipment.estado] || shipment.estado}
                          color={ESTADO_COLORS[shipment.estado] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{shipment.origen || '-'}</TableCell>
                      <TableCell>{shipment.destino || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={shipment.prioridad || '-'}
                          size="small"
                          variant="outlined"
                          color={shipment.prioridad >= 4 ? 'error' : shipment.prioridad >= 3 ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {shipment.fecha_programada
                          ? new Date(shipment.fecha_programada).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(shipment.id)
                          }}
                        >
                          <Eye fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={shipmentsTotal}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage={t('common_rows_per_page', 'Filas por pagina')}
            />
          </>
        )}
      </TableContainer>
    </Box>
  )
}
