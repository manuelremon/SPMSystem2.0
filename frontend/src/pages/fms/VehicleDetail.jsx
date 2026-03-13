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
import { formatDate } from '../../utils/formatters'
import { useI18n } from '../../context/i18n'
import { useFmsStore, useFmsCurrentVehicle } from '../../store/fmsStore'
import * as fmsService from '../../services/fms'

const ESTADO_COLORS = {
  disponible: 'success',
  en_ruta: 'primary',
  en_mantenimiento: 'warning',
  fuera_servicio: 'error',
  baja: 'default',
}

const ESTADO_KEYS = {
  disponible: 'fms_vehicle_available',
  en_ruta: 'fms_vehicle_en_route',
  en_mantenimiento: 'fms_vehicle_in_maintenance',
  fuera_servicio: 'fms_vehicle_out_of_service',
  baja: 'fms_vehicle_decommissioned',
}

const ESTADO_FALLBACKS = {
  disponible: 'Disponible',
  en_ruta: 'En Ruta',
  en_mantenimiento: 'En Mantenimiento',
  fuera_servicio: 'Fuera de Servicio',
  baja: 'Baja',
}

function getDocStatusChipKey(fechaVencimiento) {
  if (!fechaVencimiento) return { key: 'fms_no_date', fallback: 'Sin fecha', color: 'default' }
  const now = new Date()
  const venc = new Date(fechaVencimiento)
  const diffDays = Math.ceil((venc - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { key: 'fms_expired', fallback: 'Vencido', color: 'error' }
  if (diffDays <= 30) return { key: 'fms_expiring_soon', fallback: 'Por vencer', color: 'warning' }
  return { key: 'fms_valid', fallback: 'Vigente', color: 'success' }
}

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

export default function VehicleDetail() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const currentVehicle = useFmsCurrentVehicle()
  const fetchVehicle = useFmsStore(s => s.fetchVehicle)
  const error = useFmsStore(s => s.error)

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
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Box>
    )
  }

  if (!v) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
        <Alert severity="error">{t('fms_vehicle_not_found', 'Vehículo no encontrado')}</Alert>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/fms/vehicles')} sx={{ mt: 2 }}>
          {t('fms_back', 'Volver')}
        </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/fms/vehicles')}>
          <ArrowLeft />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h5" fontWeight={700} textTransform="uppercase" letterSpacing="0.5px">{v.placa}</Typography>
            <Chip
              label={t(ESTADO_KEYS[v.estado], ESTADO_FALLBACKS[v.estado]) || v.estado}
              color={ESTADO_COLORS[v.estado] || 'default'}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {v.marca} {v.modelo} {v.anio ? `(${v.anio})` : ''}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Settings />} onClick={() => setStatusDialogOpen(true)}>
          {t('fms_change_status', 'Cambiar Estado')}
        </Button>
        <Button variant="outlined" startIcon={<Edit2 />} onClick={() => navigate(`/fms/vehicles/${id}/edit`)}>
          {t('fms_edit', 'Editar')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={t('fms_tab_info', 'Información')} icon={<Truck sx={{ fontSize: 18 }} />} iconPosition="start" />
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
                <Typography variant="subtitle2" color="text.secondary">{t('fms_plate', 'Placa')}</Typography>
                <Typography variant="body1" fontWeight={500} mb={2}>{v.placa}</Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_type', 'Tipo')}</Typography>
                <Typography variant="body1" mb={2}>{v.tipo ? v.tipo.replace(/_/g, ' ') : '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_brand', 'Marca')}</Typography>
                <Typography variant="body1" mb={2}>{v.marca || '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_model', 'Modelo')}</Typography>
                <Typography variant="body1" mb={2}>{v.modelo || '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_year', 'Ano')}</Typography>
                <Typography variant="body1" mb={2}>{v.anio || '--'}</Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_vin', 'VIN')}</Typography>
                <Typography variant="body1" mb={2}>{v.vin || '--'}</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">{t('fms_capacity_kg', 'Capacidad (kg)')}</Typography>
                <Typography variant="body1" mb={2}>
                  {v.capacidad_kg ? Number(v.capacidad_kg).toLocaleString() : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_capacity_volume', 'Capacidad Volumen (m3)')}</Typography>
                <Typography variant="body1" mb={2}>
                  {v.capacidad_volumen_m3 ? Number(v.capacidad_volumen_m3).toLocaleString() : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_current_odometer', 'Odometro Actual')}</Typography>
                <Typography variant="body1" mb={2}>
                  {v.odometro_actual ? `${Number(v.odometro_actual).toLocaleString()} km` : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_fuel_efficiency', 'Rendimiento Combustible')}</Typography>
                <Typography variant="body1" mb={2}>
                  {v.rendimiento_combustible ? `${v.rendimiento_combustible} km/l` : '--'}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">{t('fms_assigned_center', 'Centro Asignado')}</Typography>
                <Typography variant="body1" mb={2}>{v.centro_id || '--'}</Typography>

                <Divider sx={{ my: 2 }} />

                {/* Photo placeholder */}
                <Box
                  sx={{
                    width: '100%',
                    height: 160,
                    bgcolor: 'grey.100',
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
          <Typography variant="h6">{t('fms_vehicle_documents', 'Documentos del Vehiculo')}</Typography>
          <Button variant="contained" size="small" startIcon={<Plus />} onClick={() => setDocDialogOpen(true)}>
            {t('fms_add_document', 'Agregar Documento')}
          </Button>
        </Stack>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('fms_doc_type', 'Tipo')}</TableCell>
                <TableCell>{t('fms_doc_number', 'Numero')}</TableCell>
                <TableCell>{t('fms_doc_issue_date', 'Emision')}</TableCell>
                <TableCell>{t('fms_doc_expiry_date', 'Vencimiento')}</TableCell>
                <TableCell>{t('fms_col_status', 'Estado')}</TableCell>
                <TableCell>{t('fms_doc_notes', 'Notas')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      {t('fms_no_documents', 'No hay documentos registrados')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {documents.map((doc, i) => {
                const status = getDocStatusChipKey(doc.fecha_vencimiento)
                return (
                  <TableRow key={doc.id || i}>
                    <TableCell>{doc.tipo_documento}</TableCell>
                    <TableCell>{doc.numero_documento || '--'}</TableCell>
                    <TableCell>{formatDate(doc.fecha_emision)}</TableCell>
                    <TableCell>{formatDate(doc.fecha_vencimiento)}</TableCell>
                    <TableCell>
                      <Chip label={t(status.key, status.fallback)} color={status.color} size="small" />
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
          <Typography variant="h6">{t('fms_maintenance_plans', 'Planes de Mantenimiento')}</Typography>
          <Button variant="contained" size="small" startIcon={<Plus />} onClick={() => setPlanDialogOpen(true)}>
            {t('fms_create_plan', 'Crear Plan')}
          </Button>
        </Stack>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('fms_doc_type', 'Tipo')}</TableCell>
                <TableCell>{t('fms_description', 'Descripcion')}</TableCell>
                <TableCell align="right">{t('fms_interval_km', 'Intervalo (km)')}</TableCell>
                <TableCell align="right">{t('fms_interval_days', 'Intervalo (dias)')}</TableCell>
                <TableCell>{t('fms_next_km', 'Proximo km')}</TableCell>
                <TableCell>{t('fms_next_date', 'Proxima Fecha')}</TableCell>
                <TableCell>{t('fms_col_status', 'Estado')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      {t('fms_no_maintenance_plans', 'No hay planes de mantenimiento')}
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
                  <TableCell>{formatDate(plan.proxima_fecha)}</TableCell>
                  <TableCell>
                    <Chip
                      label={plan.activo !== false ? t('fms_active', 'Activo') : t('fms_inactive', 'Inactivo')}
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
        <Typography variant="h6" mb={2}>{t('fms_recent_work_orders', 'Ordenes de Trabajo Recientes')}</Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('fms_col_code', 'Codigo')}</TableCell>
                <TableCell>{t('fms_doc_type', 'Tipo')}</TableCell>
                <TableCell>{t('fms_description', 'Descripcion')}</TableCell>
                <TableCell>{t('fms_col_status', 'Estado')}</TableCell>
                <TableCell>{t('fms_col_date', 'Fecha')}</TableCell>
                <TableCell align="right">{t('fms_col_total_cost', 'Costo Total')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      {t('fms_no_work_orders', 'No hay ordenes de trabajo')}
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
                  <TableCell>{formatDate(wo.fecha_ingreso || wo.created_at)}</TableCell>
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
        <DialogTitle>{t('fms_add_document', 'Agregar Documento')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('fms_document_type', 'Tipo de Documento')}</InputLabel>
              <Select
                value={docForm.tipo_documento}
                label={t('fms_document_type', 'Tipo de Documento')}
                onChange={(e) => setDocForm({ ...docForm, tipo_documento: e.target.value })}
              >
                <MenuItem value="tarjeta_circulacion">{t('fms_doc_registration_card', 'Tarjeta de Circulacion')}</MenuItem>
                <MenuItem value="seguro">{t('fms_doc_insurance', 'Seguro')}</MenuItem>
                <MenuItem value="verificacion">{t('fms_doc_verification', 'Verificacion')}</MenuItem>
                <MenuItem value="permiso_carga">{t('fms_doc_cargo_permit', 'Permiso de Carga')}</MenuItem>
                <MenuItem value="otro">{t('fms_doc_other', 'Otro')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label={t('fms_document_number', 'Numero de Documento')}
              value={docForm.numero_documento}
              onChange={(e) => setDocForm({ ...docForm, numero_documento: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label={t('fms_issue_date', 'Fecha de Emision')}
              type="date"
              value={docForm.fecha_emision}
              onChange={(e) => setDocForm({ ...docForm, fecha_emision: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label={t('fms_expiry_date', 'Fecha de Vencimiento')}
              type="date"
              value={docForm.fecha_vencimiento}
              onChange={(e) => setDocForm({ ...docForm, fecha_vencimiento: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label={t('fms_notes', 'Notas')}
              value={docForm.notas}
              onChange={(e) => setDocForm({ ...docForm, notas: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocDialogOpen(false)}>{t('fms_cancel', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleAddDocument} disabled={saving || !docForm.tipo_documento}>
            {saving ? <CircularProgress size={20} /> : t('fms_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Maintenance Plan Dialog */}
      <Dialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('fms_create_maintenance_plan', 'Crear Plan de Mantenimiento')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('fms_doc_type', 'Tipo')}</InputLabel>
              <Select
                value={planForm.tipo}
                label={t('fms_doc_type', 'Tipo')}
                onChange={(e) => setPlanForm({ ...planForm, tipo: e.target.value })}
              >
                <MenuItem value="preventivo">{t('fms_preventive', 'Preventivo')}</MenuItem>
                <MenuItem value="correctivo">{t('fms_corrective', 'Correctivo')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label={t('fms_description', 'Descripcion')}
              value={planForm.descripcion}
              onChange={(e) => setPlanForm({ ...planForm, descripcion: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              size="small"
              label={t('fms_interval_km', 'Intervalo (km)')}
              type="number"
              value={planForm.intervalo_km}
              onChange={(e) => setPlanForm({ ...planForm, intervalo_km: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label={t('fms_interval_days', 'Intervalo (dias)')}
              type="number"
              value={planForm.intervalo_dias}
              onChange={(e) => setPlanForm({ ...planForm, intervalo_dias: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label={t('fms_next_km', 'Proximo km')}
              type="number"
              value={planForm.proximo_km}
              onChange={(e) => setPlanForm({ ...planForm, proximo_km: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label={t('fms_next_date', 'Proxima Fecha')}
              type="date"
              value={planForm.proxima_fecha}
              onChange={(e) => setPlanForm({ ...planForm, proxima_fecha: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanDialogOpen(false)}>{t('fms_cancel', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleAddPlan} disabled={saving || !planForm.descripcion}>
            {saving ? <CircularProgress size={20} /> : t('fms_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('fms_change_vehicle_status', 'Cambiar Estado del Vehiculo')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('fms_current_status', 'Estado actual')}: <Chip label={t(ESTADO_KEYS[v.estado], ESTADO_FALLBACKS[v.estado]) || v.estado} color={ESTADO_COLORS[v.estado] || 'default'} size="small" />
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>{t('fms_new_status', 'Nuevo Estado')}</InputLabel>
            <Select
              value={newStatus}
              label={t('fms_new_status', 'Nuevo Estado')}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {Object.entries(ESTADO_FALLBACKS)
                .filter(([k]) => k !== v.estado)
                .map(([k, fallback]) => (
                  <MenuItem key={k} value={k}>{t(ESTADO_KEYS[k], fallback)}</MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>{t('fms_cancel', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleChangeStatus} disabled={saving || !newStatus}>
            {saving ? <CircularProgress size={20} /> : t('fms_confirm', 'Confirmar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  )
}
