import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import {
  ArrowLeft,
  CheckCircle,
  Play,
  Pause,
  Clock,
  X,
  Plus,
  Package,
  ShoppingCart,
  StarFill,
  Star,
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useFmsStore } from '../../store/fmsStore'
import * as fmsService from '../../services/fms'

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

// Map estado -> allowed transitions with labels
const TRANSITIONS = {
  draft: [{ estado: 'approved', label: 'Aprobar', color: 'info' }],
  approved: [
    { estado: 'in_progress', label: 'Iniciar', color: 'primary' },
    { estado: 'cancelled', label: 'Cancelar', color: 'error' },
  ],
  in_progress: [
    { estado: 'pending_parts', label: 'Pendiente Partes', color: 'warning' },
    { estado: 'completed', label: 'Completar', color: 'success' },
    { estado: 'cancelled', label: 'Cancelar', color: 'error' },
  ],
  pending_parts: [
    { estado: 'in_progress', label: 'Reanudar', color: 'primary' },
    { estado: 'cancelled', label: 'Cancelar', color: 'error' },
  ],
  completed: [{ estado: 'closed', label: 'Cerrar', color: 'secondary' }],
}

function PriorityBadge({ priority }) {
  const p = Number(priority) || 3
  const labels = { 1: 'Critica', 2: 'Alta', 3: 'Media', 4: 'Baja' }
  const colors = { 1: 'error', 2: 'warning', 3: 'info', 4: 'default' }
  return <Chip label={`P${p} - ${labels[p] || 'Media'}`} color={colors[p] || 'default'} size="small" />
}

export default function WorkOrderDetail() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const { currentWorkOrder, fetchWorkOrder, transitionWorkOrder, error } = useFmsStore()

  const [loading, setLoading] = useState(true)
  const [parts, setParts] = useState([])
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Complete dialog
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeForm, setCompleteForm] = useState({ solucion: '', costo_mano_obra: '' })

  // Add part dialog
  const [partOpen, setPartOpen] = useState(false)
  const [partForm, setPartForm] = useState({ material_code: '', descripcion: '', cantidad: 1, costo_unitario: '' })

  // Request part from SPM dialog
  const [spmOpen, setSpmOpen] = useState(false)
  const [spmForm, setSpmForm] = useState({ material_code: '', descripcion: '', cantidad: 1 })

  useEffect(() => {
    async function load() {
      setLoading(true)
      await fetchWorkOrder(id)
      setLoading(false)
    }
    load()
  }, [id, fetchWorkOrder])

  // Extract parts from the work order
  useEffect(() => {
    if (currentWorkOrder?.parts) {
      setParts(currentWorkOrder.parts)
    }
  }, [currentWorkOrder])

  const handleTransition = useCallback(async (estado) => {
    if (estado === 'completed') {
      setCompleteOpen(true)
      return
    }
    setSaving(true)
    setActionError(null)
    try {
      const res = await transitionWorkOrder(id, estado)
      if (!res.ok) setActionError(res.error || 'Error al cambiar estado')
    } catch (err) {
      setActionError(err.message)
    }
    setSaving(false)
  }, [id, transitionWorkOrder])

  const handleComplete = useCallback(async () => {
    setSaving(true)
    setActionError(null)
    try {
      const res = await transitionWorkOrder(id, 'completed', {
        solucion: completeForm.solucion,
        costo_mano_obra: completeForm.costo_mano_obra ? Number(completeForm.costo_mano_obra) : 0,
      })
      if (res.ok) {
        setCompleteOpen(false)
        setCompleteForm({ solucion: '', costo_mano_obra: '' })
      } else {
        setActionError(res.error || 'Error al completar')
      }
    } catch (err) {
      setActionError(err.message)
    }
    setSaving(false)
  }, [id, completeForm, transitionWorkOrder])

  const handleAddPart = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fmsService.addWorkOrderPart(id, {
        ...partForm,
        cantidad: Number(partForm.cantidad),
        costo_unitario: partForm.costo_unitario ? Number(partForm.costo_unitario) : 0,
      })
      if (res.ok) {
        setParts((prev) => [...prev, res.data])
        setPartOpen(false)
        setPartForm({ material_code: '', descripcion: '', cantidad: 1, costo_unitario: '' })
        // Refresh to get updated totals
        fetchWorkOrder(id)
      }
    } catch (_) { /* silent */ }
    setSaving(false)
  }, [id, partForm, fetchWorkOrder])

  const handleRequestSPM = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fmsService.requestPartFromSPM(id, {
        material_code: spmForm.material_code,
        descripcion: spmForm.descripcion,
        cantidad: Number(spmForm.cantidad),
      })
      if (res.ok) {
        setSpmOpen(false)
        setSpmForm({ material_code: '', descripcion: '', cantidad: 1 })
        fetchWorkOrder(id)
      }
    } catch (_) { /* silent */ }
    setSaving(false)
  }, [id, spmForm, fetchWorkOrder])

  const wo = currentWorkOrder

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  if (!wo) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('fms_wo_not_found', 'Orden de trabajo no encontrada')}</Alert>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/fms/work-orders')} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Box>
    )
  }

  const availableTransitions = TRANSITIONS[wo.estado] || []

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/fms/work-orders')}>
          <ArrowLeft />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4" fontWeight={700}>
              {wo.codigo || `OT-${wo.id}`}
            </Typography>
            <Chip
              label={ESTADO_LABELS[wo.estado] || wo.estado}
              color={ESTADO_COLORS[wo.estado] || 'default'}
            />
            <PriorityBadge priority={wo.prioridad} />
          </Stack>
        </Box>
        {availableTransitions.map((tr) => (
          <Button
            key={tr.estado}
            variant={tr.color === 'error' ? 'outlined' : 'contained'}
            color={tr.color}
            onClick={() => handleTransition(tr.estado)}
            disabled={saving}
            size="small"
          >
            {tr.label}
          </Button>
        ))}
      </Stack>

      {(error || actionError) && <Alert severity="error" sx={{ mb: 2 }}>{actionError || error}</Alert>}

      {/* Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Informacion de la Orden</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Vehiculo</Typography>
              <Typography variant="body1" fontWeight={500} mb={2}>
                {wo.vehicle_placa || `ID: ${wo.vehicle_id}`}
              </Typography>

              <Typography variant="subtitle2" color="text.secondary">Tipo</Typography>
              <Typography variant="body1" mb={2}>
                <Chip
                  label={wo.tipo || '--'}
                  size="small"
                  color={wo.tipo === 'emergencia' ? 'error' : wo.tipo === 'preventivo' ? 'info' : 'default'}
                />
              </Typography>

              <Typography variant="subtitle2" color="text.secondary">Descripcion</Typography>
              <Typography variant="body1" mb={2}>{wo.descripcion || '--'}</Typography>

              <Typography variant="subtitle2" color="text.secondary">Diagnostico</Typography>
              <Typography variant="body1" mb={2}>{wo.diagnostico || '--'}</Typography>

              <Typography variant="subtitle2" color="text.secondary">Solucion</Typography>
              <Typography variant="body1" mb={2}>{wo.solucion || '--'}</Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Tecnico Asignado</Typography>
              <Typography variant="body1" mb={2}>{wo.tecnico_nombre || wo.tecnico_id || '--'}</Typography>

              <Typography variant="subtitle2" color="text.secondary">Proveedor</Typography>
              <Typography variant="body1" mb={2}>{wo.proveedor_nombre || wo.proveedor_id || '--'}</Typography>

              <Typography variant="subtitle2" color="text.secondary">Fecha Ingreso</Typography>
              <Typography variant="body1" mb={2}>{wo.fecha_ingreso || wo.created_at || '--'}</Typography>

              <Typography variant="subtitle2" color="text.secondary">Fecha Finalizacion</Typography>
              <Typography variant="body1" mb={2}>{wo.fecha_finalizacion || '--'}</Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" color="text.secondary">Costo Repuestos</Typography>
              <Typography variant="body1" mb={1}>
                {wo.costo_repuestos != null ? `$${Number(wo.costo_repuestos).toLocaleString()}` : '--'}
              </Typography>

              <Typography variant="subtitle2" color="text.secondary">Costo Mano de Obra</Typography>
              <Typography variant="body1" mb={1}>
                {wo.costo_mano_obra != null ? `$${Number(wo.costo_mano_obra).toLocaleString()}` : '--'}
              </Typography>

              <Typography variant="subtitle2" color="text.secondary">Costo Total</Typography>
              <Typography variant="h6" fontWeight={700} color="primary">
                {wo.costo_total != null ? `$${Number(wo.costo_total).toLocaleString()}` : '--'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Parts Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Repuestos y Partes</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ShoppingCart />}
                onClick={() => setSpmOpen(true)}
              >
                Solicitar Repuesto SPM
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<Plus />}
                onClick={() => setPartOpen(true)}
              >
                Agregar Parte
              </Button>
            </Stack>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Material</TableCell>
                  <TableCell>Descripcion</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Costo Unit.</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>
                        No hay partes registradas
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {parts.map((part, i) => {
                  const subtotal = (Number(part.cantidad) || 0) * (Number(part.costo_unitario) || 0)
                  return (
                    <TableRow key={part.id || i}>
                      <TableCell>
                        <Typography fontWeight={500}>{part.material_code || '--'}</Typography>
                      </TableCell>
                      <TableCell>{part.descripcion || '--'}</TableCell>
                      <TableCell align="right">{part.cantidad || 0}</TableCell>
                      <TableCell align="right">
                        {part.costo_unitario != null ? `$${Number(part.costo_unitario).toLocaleString()}` : '--'}
                      </TableCell>
                      <TableCell align="right">
                        {subtotal ? `$${subtotal.toLocaleString()}` : '--'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={part.estado || 'disponible'}
                          size="small"
                          color={part.estado === 'pendiente' ? 'warning' : 'success'}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Complete Dialog */}
      <Dialog open={completeOpen} onClose={() => setCompleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Completar Orden de Trabajo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Solucion Aplicada"
              value={completeForm.solucion}
              onChange={(e) => setCompleteForm({ ...completeForm, solucion: e.target.value })}
              multiline
              rows={3}
              fullWidth
              required
            />
            <TextField
              size="small"
              label="Costo Mano de Obra ($)"
              type="number"
              value={completeForm.costo_mano_obra}
              onChange={(e) => setCompleteForm({ ...completeForm, costo_mano_obra: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleComplete}
            disabled={saving || !completeForm.solucion}
          >
            {saving ? <CircularProgress size={20} /> : 'Completar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Part Dialog */}
      <Dialog open={partOpen} onClose={() => setPartOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Agregar Parte / Repuesto</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Codigo Material"
              value={partForm.material_code}
              onChange={(e) => setPartForm({ ...partForm, material_code: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Descripcion"
              value={partForm.descripcion}
              onChange={(e) => setPartForm({ ...partForm, descripcion: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Cantidad"
              type="number"
              value={partForm.cantidad}
              onChange={(e) => setPartForm({ ...partForm, cantidad: e.target.value })}
              fullWidth
              inputProps={{ min: 1 }}
            />
            <TextField
              size="small"
              label="Costo Unitario ($)"
              type="number"
              value={partForm.costo_unitario}
              onChange={(e) => setPartForm({ ...partForm, costo_unitario: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPartOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAddPart}
            disabled={saving || !partForm.descripcion}
          >
            {saving ? <CircularProgress size={20} /> : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Part from SPM Dialog */}
      <Dialog open={spmOpen} onClose={() => setSpmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Solicitar Repuesto desde SPM</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Esta accion creara una solicitud de material en el sistema SPM vinculada a esta orden de trabajo.
          </Alert>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Codigo Material SAP"
              value={spmForm.material_code}
              onChange={(e) => setSpmForm({ ...spmForm, material_code: e.target.value })}
              fullWidth
              helperText="Ingrese el codigo SAP del material"
            />
            <TextField
              size="small"
              label="Descripcion"
              value={spmForm.descripcion}
              onChange={(e) => setSpmForm({ ...spmForm, descripcion: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Cantidad"
              type="number"
              value={spmForm.cantidad}
              onChange={(e) => setSpmForm({ ...spmForm, cantidad: e.target.value })}
              fullWidth
              inputProps={{ min: 1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpmOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ShoppingCart />}
            onClick={handleRequestSPM}
            disabled={saving || !spmForm.material_code || !spmForm.cantidad}
          >
            {saving ? <CircularProgress size={20} /> : 'Solicitar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
