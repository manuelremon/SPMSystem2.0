import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import {
  ArrowLeft,
  Edit2,
  FileText,
  Plus,
  Truck,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  History,
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useFmsStore } from '../../store/fmsStore'
import * as fmsService from '../../services/fms'

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

function getDocStatusChip(fechaVencimiento) {
  if (!fechaVencimiento) return { label: 'Sin fecha', color: 'default' }
  const now = new Date()
  const venc = new Date(fechaVencimiento)
  const diffDays = Math.ceil((venc - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: 'Vencido', color: 'error' }
  if (diffDays <= 30) return { label: 'Por vencer', color: 'warning' }
  return { label: 'Vigente', color: 'success' }
}

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

export default function VehicleDetail() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const { currentVehicle, fetchVehicle, error } = useFmsStore()

  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState([])
  const [plans, setPlans] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [docDialogOpen, setDocDialogOpen] = useState(false)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [docForm, setDocForm] = useState({ tipo_documento: '', numero_documento: '', fecha_emision: '', fecha_vencimiento: '', notas: '' })
  const [planForm, setPlanForm] = useState({ tipo: 'preventivo', descripcion: '', intervalo_km: '', intervalo_dias: '', proximo_km: '', proxima_fecha: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      await fetchVehicle(id)
      try {
        const [docsRes, plansRes, woRes] = await Promise.all([
          fmsService.getVehicleDocuments(id),
          fmsService.getMaintenancePlans(id),
          fmsService.getWorkOrders({ vehicle_id: id, limit: 20 }),
        ])
        if (docsRes.ok) setDocuments(docsRes.data || [])
        if (plansRes.ok) setPlans(plansRes.data || [])
        if (woRes.ok) setWorkOrders(woRes.data?.items || woRes.data || [])
      } catch (_) { /* silent */ }
      setLoading(false)
    }
    load()
  }, [id, fetchVehicle])

  const handleAddDocument = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fmsService.addVehicleDocument(id, docForm)
      if (res.ok) {
        setDocuments((prev) => [res.data, ...prev])
        setDocDialogOpen(false)
        setDocForm({ tipo_documento: '', numero_documento: '', fecha_emision: '', fecha_vencimiento: '', notas: '' })
      }
    } catch (_) { /* silent */ }
    setSaving(false)
  }, [id, docForm])

  const handleAddPlan = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fmsService.createMaintenancePlan(id, {
        ...planForm,
        intervalo_km: planForm.intervalo_km ? Number(planForm.intervalo_km) : null,
        intervalo_dias: planForm.intervalo_dias ? Number(planForm.intervalo_dias) : null,
        proximo_km: planForm.proximo_km ? Number(planForm.proximo_km) : null,
      })
      if (res.ok) {
        setPlans((prev) => [res.data, ...prev])
        setPlanDialogOpen(false)
        setPlanForm({ tipo: 'preventivo', descripcion: '', intervalo_km: '', intervalo_dias: '', proximo_km: '', proxima_fecha: '' })
      }
    } catch (_) { /* silent */ }
    setSaving(false)
  }, [id, planForm])

  const handleChangeStatus = useCallback(async () => {
    if (!newStatus) return
    setSaving(true)
    try {
      const res = await fmsService.changeVehicleStatus(id, newStatus)
      if (res.ok) {
        await fetchVehicle(id)
        setStatusDialogOpen(false)
        setNewStatus('')
      }
    } catch (_) { /* silent */ }
    setSaving(false)
  }, [id, newStatus, fetchVehicle])

  const v = currentVehicle

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  if (!v) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('fms_vehicle_not_found', 'Vehiculo no encontrado')}</Alert>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/fms/vehicles')} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/fms/vehicles')}>
          <ArrowLeft />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4" fontWeight={700}>{v.placa}</Typography>
            <Chip
              label={ESTADO_LABELS[v.estado] || v.estado}
              color={ESTADO_COLORS[v.estado] || 'default'}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ''}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Settings />} onClick={() => setStatusDialogOpen(true)}>
          Cambiar Estado
        </Button>
        <Button variant="outlined" startIcon={<Edit2 />} onClick={() => navigate(`/fms/vehicles/${id}/edit`)}>
          Editar
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={t('fms_tab_info', 'Informacion')} icon={<Truck sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label={t('fms_tab_docs', 'Documentos')} icon={<FileText sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label={t('fms_tab_maintenance', 'Mantenimiento')} icon={<Settings sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label={t('fms_tab_history', 'Historial')} icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 1: Informacion */}
      <TabPanel value={tab} index={0}>
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Placa</Typography>
                <Typography variant="body1" fontWeight={500} mb={2}>{v.placa}</Typography>

                <Typography variant="subtitle2" color="text.secondary">Tipo</Typography>
                <Typography variant="body1" mb={2}>{v.tipo ? v.tipo.replace(/_/g, ' ') : '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">Marca</Typography>
                <Typography variant="body1" mb={2}>{v.marca || '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">Modelo</Typography>
                <Typography variant="body1" mb={2}>{v.modelo || '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">Anio</Typography>
                <Typography variant="body1" mb={2}>{v.anio || '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">VIN</Typography>
                <Typography variant="body1" mb={2}>{v.vin || '--'}</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Capacidad (kg)</Typography>
                <Typography variant="body1" mb={2}>
                  {v.capacidad_kg ? Number(v.capacidad_kg).toLocaleString() : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">Capacidad Volumen (m3)</Typography>
                <Typography variant="body1" mb={2}>
                  {v.capacidad_volumen_m3 ? Number(v.capacidad_volumen_m3).toLocaleString() : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">Odometro Actual</Typography>
                <Typography variant="body1" mb={2}>
                  {v.odometro_actual ? `${Number(v.odometro_actual).toLocaleString()} km` : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">Rendimiento Combustible</Typography>
                <Typography variant="body1" mb={2}>
                  {v.rendimiento_combustible ? `${v.rendimiento_combustible} km/l` : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">Centro Asignado</Typography>
                <Typography variant="body1" mb={2}>{v.centro_id || '--'}</Typography>

                <Divider sx={{ my: 2 }} />

                {/* Photo placeholder */}
                <Box
                  sx={{
                    width: '100%',
                    height: 160,
                    bgcolor: 'grey.100',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Truck sx={{ fontSize: 48, color: 'text.disabled' }} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 2: Documentos */}
      <TabPanel value={tab} index={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Documentos del Vehiculo</Typography>
          <Button variant="contained" size="small" startIcon={<Plus />} onClick={() => setDocDialogOpen(true)}>
            Agregar Documento
          </Button>
        </Stack>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Numero</TableCell>
                <TableCell>Emision</TableCell>
                <TableCell>Vencimiento</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Notas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No hay documentos registrados
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {documents.map((doc, i) => {
                const status = getDocStatusChip(doc.fecha_vencimiento)
                return (
                  <TableRow key={doc.id || i}>
                    <TableCell>{doc.tipo_documento}</TableCell>
                    <TableCell>{doc.numero_documento || '--'}</TableCell>
                    <TableCell>{doc.fecha_emision || '--'}</TableCell>
                    <TableCell>{doc.fecha_vencimiento || '--'}</TableCell>
                    <TableCell>
                      <Chip label={status.label} color={status.color} size="small" />
                    </TableCell>
                    <TableCell>{doc.notas || '--'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 3: Mantenimiento */}
      <TabPanel value={tab} index={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Planes de Mantenimiento</Typography>
          <Button variant="contained" size="small" startIcon={<Plus />} onClick={() => setPlanDialogOpen(true)}>
            Crear Plan
          </Button>
        </Stack>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Descripcion</TableCell>
                <TableCell align="right">Intervalo (km)</TableCell>
                <TableCell align="right">Intervalo (dias)</TableCell>
                <TableCell>Proximo km</TableCell>
                <TableCell>Proxima Fecha</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No hay planes de mantenimiento
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {plans.map((plan, i) => (
                <TableRow key={plan.id || i}>
                  <TableCell>
                    <Chip label={plan.tipo || 'preventivo'} size="small" color="info" />
                  </TableCell>
                  <TableCell>{plan.descripcion || '--'}</TableCell>
                  <TableCell align="right">{plan.intervalo_km ? Number(plan.intervalo_km).toLocaleString() : '--'}</TableCell>
                  <TableCell align="right">{plan.intervalo_dias || '--'}</TableCell>
                  <TableCell>{plan.proximo_km ? Number(plan.proximo_km).toLocaleString() : '--'}</TableCell>
                  <TableCell>{plan.proxima_fecha || '--'}</TableCell>
                  <TableCell>
                    <Chip
                      label={plan.activo !== false ? 'Activo' : 'Inactivo'}
                      color={plan.activo !== false ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 4: Historial */}
      <TabPanel value={tab} index={3}>
        <Typography variant="h6" mb={2}>Ordenes de Trabajo Recientes</Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Codigo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Descripcion</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="right">Costo Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No hay ordenes de trabajo
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {workOrders.map((wo, i) => (
                <TableRow
                  key={wo.id || i}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/fms/work-orders/${wo.id}`)}
                >
                  <TableCell>
                    <Typography fontWeight={600}>{wo.codigo || `OT-${wo.id}`}</Typography>
                  </TableCell>
                  <TableCell>{wo.tipo || '--'}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wo.descripcion || '--'}
                  </TableCell>
                  <TableCell>
                    <Chip label={wo.estado || '--'} size="small" />
                  </TableCell>
                  <TableCell>{wo.fecha_ingreso || wo.created_at || '--'}</TableCell>
                  <TableCell align="right">
                    {wo.costo_total != null ? `$${Number(wo.costo_total).toLocaleString()}` : '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Add Document Dialog */}
      <Dialog open={docDialogOpen} onClose={() => setDocDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Agregar Documento</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Documento</InputLabel>
              <Select
                value={docForm.tipo_documento}
                label="Tipo de Documento"
                onChange={(e) => setDocForm({ ...docForm, tipo_documento: e.target.value })}
              >
                <MenuItem value="tarjeta_circulacion">Tarjeta de Circulacion</MenuItem>
                <MenuItem value="seguro">Seguro</MenuItem>
                <MenuItem value="verificacion">Verificacion</MenuItem>
                <MenuItem value="permiso_carga">Permiso de Carga</MenuItem>
                <MenuItem value="otro">Otro</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Numero de Documento"
              value={docForm.numero_documento}
              onChange={(e) => setDocForm({ ...docForm, numero_documento: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Fecha de Emision"
              type="date"
              value={docForm.fecha_emision}
              onChange={(e) => setDocForm({ ...docForm, fecha_emision: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label="Fecha de Vencimiento"
              type="date"
              value={docForm.fecha_vencimiento}
              onChange={(e) => setDocForm({ ...docForm, fecha_vencimiento: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label="Notas"
              value={docForm.notas}
              onChange={(e) => setDocForm({ ...docForm, notas: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddDocument} disabled={saving || !docForm.tipo_documento}>
            {saving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Maintenance Plan Dialog */}
      <Dialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear Plan de Mantenimiento</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo</InputLabel>
              <Select
                value={planForm.tipo}
                label="Tipo"
                onChange={(e) => setPlanForm({ ...planForm, tipo: e.target.value })}
              >
                <MenuItem value="preventivo">Preventivo</MenuItem>
                <MenuItem value="correctivo">Correctivo</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Descripcion"
              value={planForm.descripcion}
              onChange={(e) => setPlanForm({ ...planForm, descripcion: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              size="small"
              label="Intervalo (km)"
              type="number"
              value={planForm.intervalo_km}
              onChange={(e) => setPlanForm({ ...planForm, intervalo_km: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Intervalo (dias)"
              type="number"
              value={planForm.intervalo_dias}
              onChange={(e) => setPlanForm({ ...planForm, intervalo_dias: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Proximo km"
              type="number"
              value={planForm.proximo_km}
              onChange={(e) => setPlanForm({ ...planForm, proximo_km: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Proxima Fecha"
              type="date"
              value={planForm.proxima_fecha}
              onChange={(e) => setPlanForm({ ...planForm, proxima_fecha: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddPlan} disabled={saving || !planForm.descripcion}>
            {saving ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cambiar Estado del Vehiculo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Estado actual: <Chip label={ESTADO_LABELS[v.estado] || v.estado} color={ESTADO_COLORS[v.estado] || 'default'} size="small" />
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Nuevo Estado</InputLabel>
            <Select
              value={newStatus}
              label="Nuevo Estado"
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {Object.entries(ESTADO_LABELS)
                .filter(([k]) => k !== v.estado)
                .map(([k, label]) => (
                  <MenuItem key={k} value={k}>{label}</MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleChangeStatus} disabled={saving || !newStatus}>
            {saving ? <CircularProgress size={20} /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
