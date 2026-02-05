import React, { useEffect, useState, useCallback } from 'react'
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
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import {
  Plus,
  Users,
  Edit2,
  Check,
  X,
  Search,
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useFleet } from '../../hooks/useFleet'
import * as fmsService from '../../services/fms'

const ESTADO_COLORS = {
  activo: 'success',
  inactivo: 'default',
  vacaciones: 'info',
  incapacidad: 'warning',
  baja: 'error',
}

const ESTADO_LABELS = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  vacaciones: 'Vacaciones',
  incapacidad: 'Incapacidad',
  baja: 'Baja',
}

const TIPOS_LICENCIA = ['A', 'B', 'C', 'D', 'E', 'Federal']

function getDateChip(dateStr) {
  if (!dateStr) return { label: 'Sin fecha', color: 'default' }
  const now = new Date()
  const target = new Date(dateStr)
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: 'Vencido', color: 'error' }
  if (diffDays <= 30) return { label: 'Por vencer', color: 'warning' }
  return { label: 'Vigente', color: 'success' }
}

const EMPTY_FORM = {
  nombre: '',
  apellido: '',
  numero_licencia: '',
  tipo_licencia: '',
  vigencia_licencia: '',
  vigencia_medica: '',
  hazmat: false,
  telefono: '',
  estado: 'activo',
}

export default function DriversList() {
  const { t } = useI18n()
  const { drivers, loading, error, loadDrivers, createDriver } = useFleet()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadDrivers()
  }, [loadDrivers])

  const handleOpen = (driver = null) => {
    if (driver) {
      setEditingDriver(driver)
      setForm({
        nombre: driver.nombre || '',
        apellido: driver.apellido || '',
        numero_licencia: driver.numero_licencia || '',
        tipo_licencia: driver.tipo_licencia || '',
        vigencia_licencia: driver.vigencia_licencia || '',
        vigencia_medica: driver.vigencia_medica || '',
        hazmat: driver.hazmat || false,
        telefono: driver.telefono || '',
        estado: driver.estado || 'activo',
      })
    } else {
      setEditingDriver(null)
      setForm({ ...EMPTY_FORM })
    }
    setDialogOpen(true)
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (editingDriver) {
        const res = await fmsService.updateDriver(editingDriver.id, form)
        if (res.ok) {
          loadDrivers()
          setDialogOpen(false)
        }
      } else {
        const res = await createDriver(form)
        if (res.ok) {
          setDialogOpen(false)
        }
      }
    } catch (_) { /* silent */ }
    setSaving(false)
  }, [editingDriver, form, createDriver, loadDrivers])

  const filteredDrivers = (drivers || []).filter((d) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      (d.nombre || '').toLowerCase().includes(q) ||
      (d.apellido || '').toLowerCase().includes(q) ||
      (d.numero_licencia || '').toLowerCase().includes(q)
    )
  })

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {t('fms_drivers_title', 'Conductores')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fms_drivers_subtitle', 'Gestion de conductores y licencias')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus />} onClick={() => handleOpen()}>
          {t('fms_new_driver', 'Nuevo Conductor')}
        </Button>
      </Stack>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder={t('fms_search_driver', 'Buscar por nombre, licencia...')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          fullWidth
        />
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {!loading && filteredDrivers.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Users sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            {t('fms_no_drivers', 'No se encontraron conductores')}
          </Typography>
        </Paper>
      )}

      {!loading && filteredDrivers.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Licencia</TableCell>
                <TableCell>Tipo Lic.</TableCell>
                <TableCell>Vigencia Lic.</TableCell>
                <TableCell>Vigencia Medica</TableCell>
                <TableCell align="center">Hazmat</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDrivers.map((d) => {
                const licStatus = getDateChip(d.vigencia_licencia)
                const medStatus = getDateChip(d.vigencia_medica)
                return (
                  <TableRow key={d.id} hover>
                    <TableCell>
                      <Typography fontWeight={500}>
                        {d.nombre} {d.apellido}
                      </Typography>
                    </TableCell>
                    <TableCell>{d.numero_licencia || '--'}</TableCell>
                    <TableCell>{d.tipo_licencia || '--'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{d.vigencia_licencia || '--'}</Typography>
                        <Chip label={licStatus.label} color={licStatus.color} size="small" />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{d.vigencia_medica || '--'}</Typography>
                        <Chip label={medStatus.label} color={medStatus.color} size="small" />
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      {d.hazmat ? (
                        <Check sx={{ color: 'success.main', fontSize: 20 }} />
                      ) : (
                        <X sx={{ color: 'text.disabled', fontSize: 20 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ESTADO_LABELS[d.estado] || d.estado || 'activo'}
                        color={ESTADO_COLORS[d.estado] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpen(d)}>
                        <Edit2 sx={{ fontSize: 18 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDriver ? 'Editar Conductor' : 'Nuevo Conductor'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                label="Nombre"
                value={form.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
                fullWidth
                autoComplete="given-name"
              />
              <TextField
                size="small"
                label="Apellido"
                value={form.apellido}
                onChange={(e) => updateField('apellido', e.target.value)}
                fullWidth
                autoComplete="family-name"
              />
            </Stack>
            <TextField
              size="small"
              label="Numero de Licencia"
              value={form.numero_licencia}
              onChange={(e) => updateField('numero_licencia', e.target.value)}
              fullWidth
            />
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Licencia</InputLabel>
              <Select
                value={form.tipo_licencia}
                label="Tipo de Licencia"
                onChange={(e) => updateField('tipo_licencia', e.target.value)}
              >
                {TIPOS_LICENCIA.map((tipo) => (
                  <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Vigencia Licencia"
              type="date"
              value={form.vigencia_licencia}
              onChange={(e) => updateField('vigencia_licencia', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label="Vigencia Medica"
              type="date"
              value={form.vigencia_medica}
              onChange={(e) => updateField('vigencia_medica', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label="Telefono"
              value={form.telefono}
              onChange={(e) => updateField('telefono', e.target.value)}
              fullWidth
              autoComplete="tel"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.hazmat}
                  onChange={(e) => updateField('hazmat', e.target.checked)}
                />
              }
              label="Certificacion Hazmat"
            />
            {editingDriver && (
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  value={form.estado}
                  label="Estado"
                  onChange={(e) => updateField('estado', e.target.value)}
                >
                  {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.nombre}
          >
            {saving ? <CircularProgress size={20} /> : (editingDriver ? 'Guardar' : 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
