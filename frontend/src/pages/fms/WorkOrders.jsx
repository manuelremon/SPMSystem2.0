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
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TablePagination from '@mui/material/TablePagination'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import {
  Plus,
  ClipboardList,
  Search,
  Star,
  StarFill,
  AlertTriangle,
} from '../../components/ui/Icons'
import { formatDate } from '../../utils/formatters'
import { useI18n } from '../../context/i18n'
import { useFmsStore } from '../../store/fmsStore'

const ESTADO_COLORS = {
  draft: 'default',
  approved: 'info',
  in_progress: 'primary',
  pending_parts: 'warning',
  completed: 'success',
  closed: 'secondary',
  cancelled: 'error',
}

const ESTADO_LABELS = {
  draft: 'Borrador',
  approved: 'Aprobada',
  in_progress: 'En Progreso',
  pending_parts: 'Pendiente Partes',
  completed: 'Completada',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
}

const TIPOS_OT = [
  { value: '', label: 'Todos' },
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'emergencia', label: 'Emergencia' },
]

const PRIORIDADES = [
  { value: '', label: 'Todas' },
  { value: '1', label: '1 - Crítica' },
  { value: '2', label: '2 - Alta' },
  { value: '3', label: '3 - Media' },
  { value: '4', label: '4 - Baja' },
]

function PriorityStars({ priority }) {
  const p = Number(priority) || 3
  const maxStars = 4
  const filled = Math.max(0, maxStars - p + 1)
  const isUrgent = p <= 1
  return (
    <Stack direction="row" spacing={0} alignItems="center">
      {Array.from({ length: maxStars }).map((_, i) => (
        i < filled
          ? <StarFill key={i} sx={{ fontSize: 16, color: isUrgent ? 'error.main' : 'warning.main' }} />
          : <Star key={i} sx={{ fontSize: 16, color: 'text.disabled' }} />
      ))}
    </Stack>
  )
}

export default function WorkOrders() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const workOrders = useFmsStore(s => s.workOrders)
  const workOrdersTotal = useFmsStore(s => s.workOrdersTotal)
  const workOrdersLoading = useFmsStore(s => s.workOrdersLoading)
  const error = useFmsStore(s => s.error)
  const fetchWorkOrders = useFmsStore(s => s.fetchWorkOrders)
  const createWorkOrder = useFmsStore(s => s.createWorkOrder)

  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    vehicle_id: '',
    tipo: 'correctivo',
    prioridad: 3,
    descripcion: '',
  })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(() => {
    const params = { page: page + 1, per_page: rowsPerPage }
    if (filtroEstado) params.estado = filtroEstado
    if (filtroTipo) params.tipo = filtroTipo
    if (filtroPrioridad) params.prioridad = filtroPrioridad
    if (searchText) params.q = searchText
    fetchWorkOrders(params)
  }, [page, rowsPerPage, filtroEstado, filtroTipo, filtroPrioridad, searchText, fetchWorkOrders])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleChangePage = (_, newPage) => setPage(newPage)

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10))
    setPage(0)
  }

  const handleCreate = useCallback(async () => {
    setSaving(true)
    try {
      const res = await createWorkOrder({
        ...createForm,
        prioridad: Number(createForm.prioridad),
        vehicle_id: Number(createForm.vehicle_id),
      })
      if (res.ok) {
        setCreateOpen(false)
        setCreateForm({ vehicle_id: '', tipo: 'correctivo', prioridad: 3, descripcion: '' })
        loadData()
      }
    } catch (_) { /* silent */ }
    setSaving(false)
  }, [createForm, createWorkOrder, loadData])

  const items = workOrders || []

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
            {t('fms_workorders_title', 'Órdenes de Trabajo')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fms_workorders_subtitle', 'Gestión de mantenimiento y reparaciones')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus />} onClick={() => setCreateOpen(true)}>
          {t('fms_new_workorder', 'Nueva OT')}
        </Button>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filtroEstado}
              label="Estado"
              onChange={(e) => { setFiltroEstado(e.target.value); setPage(0) }}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Tipo</InputLabel>
            <Select
              value={filtroTipo}
              label="Tipo"
              onChange={(e) => { setFiltroTipo(e.target.value); setPage(0) }}
            >
              {TIPOS_OT.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Prioridad</InputLabel>
            <Select
              value={filtroPrioridad}
              label="Prioridad"
              onChange={(e) => { setFiltroPrioridad(e.target.value); setPage(0) }}
            >
              {PRIORIDADES.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder={t('fms_search_wo', 'Buscar por vehículo, código...')}
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(0) }}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ flexGrow: 1 }}
          />
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {workOrdersLoading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {!workOrdersLoading && items.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <ClipboardList sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            {t('fms_no_workorders', 'No se encontraron órdenes de trabajo')}
          </Typography>
        </Paper>
      )}

      {!workOrdersLoading && items.length > 0 && (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Vehículo</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Prioridad</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Fecha Ingreso</TableCell>
                  <TableCell align="right">Costo Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((wo) => (
                  <TableRow
                    key={wo.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/fms/work-orders/${wo.id}`)}
                  >
                    <TableCell>
                      <Typography fontWeight={600}>{wo.codigo || `OT-${wo.id}`}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={wo.vehicle_placa || wo.vehicle_id || '--'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={wo.tipo || '--'}
                        size="small"
                        color={wo.tipo === 'emergencia' ? 'error' : wo.tipo === 'preventivo' ? 'info' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ESTADO_LABELS[wo.estado] || wo.estado || '--'}
                        color={ESTADO_COLORS[wo.estado] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <PriorityStars priority={wo.prioridad} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wo.descripcion || '--'}
                    </TableCell>
                    <TableCell>{formatDate(wo.fecha_ingreso || wo.created_at)}</TableCell>
                    <TableCell align="right">
                      {wo.costo_total != null ? `$${Number(wo.costo_total).toLocaleString()}` : '--'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={workOrdersTotal || items.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="Filas por página:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`}
          />
        </Paper>
      )}

      {/* Create Work Order Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Orden de Trabajo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="ID Vehículo"
              type="number"
              value={createForm.vehicle_id}
              onChange={(e) => setCreateForm({ ...createForm, vehicle_id: e.target.value })}
              fullWidth
              helperText="Ingrese el ID del vehículo"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Tipo</InputLabel>
              <Select
                value={createForm.tipo}
                label="Tipo"
                onChange={(e) => setCreateForm({ ...createForm, tipo: e.target.value })}
              >
                <MenuItem value="preventivo">Preventivo</MenuItem>
                <MenuItem value="correctivo">Correctivo</MenuItem>
                <MenuItem value="emergencia">Emergencia</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Prioridad</InputLabel>
              <Select
                value={createForm.prioridad}
                label="Prioridad"
                onChange={(e) => setCreateForm({ ...createForm, prioridad: e.target.value })}
              >
                <MenuItem value={1}>1 - Crítica</MenuItem>
                <MenuItem value={2}>2 - Alta</MenuItem>
                <MenuItem value={3}>3 - Media</MenuItem>
                <MenuItem value={4}>4 - Baja</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Descripción"
              value={createForm.descripcion}
              onChange={(e) => setCreateForm({ ...createForm, descripcion: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !createForm.vehicle_id || !createForm.descripcion}
          >
            {saving ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  )
}
