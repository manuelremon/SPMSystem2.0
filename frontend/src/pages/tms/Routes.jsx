import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, IconButton,
  CircularProgress, Alert, Switch, FormControlLabel, Grid
} from '@mui/material'
import { Map, Plus, Edit2, RefreshCw } from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore } from '../../store/tmsStore'
import * as tmsService from '../../services/tms'

const TIPO_VIA_OPTIONS = [
  { value: 'carretera', label: 'Carretera' },
  { value: 'autopista', label: 'Autopista' },
  { value: 'terraceria', label: 'Terraceria' },
  { value: 'mixta', label: 'Mixta' },
]

const EMPTY_ROUTE = {
  nombre: '',
  origen: '',
  destino: '',
  distancia_km: '',
  tiempo_estimado_hrs: '',
  tipo_via: 'carretera',
  activa: true,
  notas: '',
}

export default function Routes() {
  const { t } = useI18n()
  const { routes, fetchRoutes } = useTmsStore()

  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_ROUTE })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRoutes()
  }, [])

  const loadRoutes = async () => {
    setLoading(true)
    try {
      await fetchRoutes()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingRoute(null)
    setForm({ ...EMPTY_ROUTE })
    setDialogOpen(true)
  }

  const handleOpenEdit = (route) => {
    setEditingRoute(route)
    setForm({
      nombre: route.nombre || '',
      origen: route.origen || '',
      destino: route.destino || '',
      distancia_km: route.distancia_km || '',
      tiempo_estimado_hrs: route.tiempo_estimado_hrs || '',
      tipo_via: route.tipo_via || 'carretera',
      activa: route.activa !== false,
      notas: route.notas || '',
    })
    setDialogOpen(true)
  }

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.nombre || !form.origen || !form.destino) {
      setError(t('tms_error_route_fields', 'Nombre, origen y destino son obligatorios'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        distancia_km: form.distancia_km ? Number(form.distancia_km) : null,
        tiempo_estimado_hrs: form.tiempo_estimado_hrs ? Number(form.tiempo_estimado_hrs) : null,
      }
      let res
      if (editingRoute) {
        res = await tmsService.updateRoute(editingRoute.id, payload)
      } else {
        res = await tmsService.createRoute(payload)
      }
      if (res.ok) {
        setDialogOpen(false)
        await loadRoutes()
      } else {
        setError(res.error || 'Error al guardar ruta')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Map sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={600}>
            {t('tms_routes_title', 'Rutas')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" startIcon={<Plus />} onClick={handleOpenCreate}>
            {t('tms_new_route', 'Nueva Ruta')}
          </Button>
          <IconButton onClick={loadRoutes} title={t('common_refresh', 'Refrescar')}>
            <RefreshCw />
          </IconButton>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('tms_route_nombre', 'Nombre')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('tms_route_origen', 'Origen')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('tms_route_destino', 'Destino')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_route_distancia', 'Distancia (km)')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_route_tiempo', 'Tiempo (hrs)')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('tms_route_tipo_via', 'Tipo Via')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('tms_route_activa', 'Activa')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('tms_col_acciones', 'Acciones')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(routes || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {t('tms_no_routes', 'No hay rutas registradas')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (routes || []).map(route => (
                  <TableRow key={route.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{route.nombre}</Typography>
                    </TableCell>
                    <TableCell>{route.origen}</TableCell>
                    <TableCell>{route.destino}</TableCell>
                    <TableCell align="right">{route.distancia_km ?? '-'}</TableCell>
                    <TableCell align="right">{route.tiempo_estimado_hrs ?? '-'}</TableCell>
                    <TableCell>
                      <Chip label={route.tipo_via || '-'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={route.activa !== false ? 'Si' : 'No'}
                        size="small"
                        color={route.activa !== false ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenEdit(route)}>
                        <Edit2 fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRoute
            ? t('tms_edit_route', 'Editar Ruta')
            : t('tms_new_route', 'Nueva Ruta')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('tms_route_nombre', 'Nombre')}
              value={form.nombre}
              onChange={(e) => handleFieldChange('nombre', e.target.value)}
              fullWidth
              required
              autoComplete="off"
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_route_origen', 'Origen')}
                  value={form.origen}
                  onChange={(e) => handleFieldChange('origen', e.target.value)}
                  fullWidth
                  required
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_route_destino', 'Destino')}
                  value={form.destino}
                  onChange={(e) => handleFieldChange('destino', e.target.value)}
                  fullWidth
                  required
                  autoComplete="off"
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_route_distancia', 'Distancia (km)')}
                  type="number"
                  value={form.distancia_km}
                  onChange={(e) => handleFieldChange('distancia_km', e.target.value)}
                  fullWidth
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_route_tiempo', 'Tiempo (hrs)')}
                  type="number"
                  value={form.tiempo_estimado_hrs}
                  onChange={(e) => handleFieldChange('tiempo_estimado_hrs', e.target.value)}
                  fullWidth
                  autoComplete="off"
                />
              </Grid>
            </Grid>
            <FormControl fullWidth>
              <InputLabel>{t('tms_route_tipo_via', 'Tipo Via')}</InputLabel>
              <Select
                value={form.tipo_via}
                label={t('tms_route_tipo_via', 'Tipo Via')}
                onChange={(e) => handleFieldChange('tipo_via', e.target.value)}
              >
                {TIPO_VIA_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('tms_route_notas', 'Notas')}
              value={form.notas}
              onChange={(e) => handleFieldChange('notas', e.target.value)}
              fullWidth
              multiline
              rows={2}
              autoComplete="off"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.activa}
                  onChange={(e) => handleFieldChange('activa', e.target.checked)}
                />
              }
              label={t('tms_route_activa', 'Activa')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={18} /> : t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
