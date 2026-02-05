import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, IconButton, CircularProgress, Alert, Switch,
  FormControlLabel, Grid
} from '@mui/material'
import { DollarSign, Plus, Edit2, RefreshCw } from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore } from '../../store/tmsStore'
import * as tmsService from '../../services/tms'

const EMPTY_TARIFF = {
  nombre: '',
  tarifa_km: '',
  tarifa_kg: '',
  tarifa_m3: '',
  recargo_combustible_pct: '',
  recargo_seguro_pct: '',
  vigencia_desde: '',
  vigencia_hasta: '',
  activa: true,
}

export default function TariffRules() {
  const { t } = useI18n()
  const { tariffs, fetchTariffs } = useTmsStore()

  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTariff, setEditingTariff] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_TARIFF })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTariffs()
  }, [])

  const loadTariffs = async () => {
    setLoading(true)
    try {
      await fetchTariffs()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingTariff(null)
    setForm({ ...EMPTY_TARIFF })
    setDialogOpen(true)
  }

  const handleOpenEdit = (tariff) => {
    setEditingTariff(tariff)
    setForm({
      nombre: tariff.nombre || '',
      tarifa_km: tariff.tarifa_km ?? '',
      tarifa_kg: tariff.tarifa_kg ?? '',
      tarifa_m3: tariff.tarifa_m3 ?? '',
      recargo_combustible_pct: tariff.recargo_combustible_pct ?? '',
      recargo_seguro_pct: tariff.recargo_seguro_pct ?? '',
      vigencia_desde: tariff.vigencia_desde || '',
      vigencia_hasta: tariff.vigencia_hasta || '',
      activa: tariff.activa !== false,
    })
    setDialogOpen(true)
  }

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.nombre) {
      setError(t('tms_error_tariff_name', 'El nombre de la tarifa es obligatorio'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        nombre: form.nombre,
        tarifa_km: form.tarifa_km !== '' ? Number(form.tarifa_km) : null,
        tarifa_kg: form.tarifa_kg !== '' ? Number(form.tarifa_kg) : null,
        tarifa_m3: form.tarifa_m3 !== '' ? Number(form.tarifa_m3) : null,
        recargo_combustible_pct: form.recargo_combustible_pct !== '' ? Number(form.recargo_combustible_pct) : null,
        recargo_seguro_pct: form.recargo_seguro_pct !== '' ? Number(form.recargo_seguro_pct) : null,
        vigencia_desde: form.vigencia_desde || null,
        vigencia_hasta: form.vigencia_hasta || null,
        activa: form.activa,
      }
      let res
      if (editingTariff) {
        res = await tmsService.updateTariff(editingTariff.id, payload)
      } else {
        res = await tmsService.createTariff(payload)
      }
      if (res.ok) {
        setDialogOpen(false)
        await loadTariffs()
      } else {
        setError(res.error || 'Error al guardar tarifa')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value) => {
    if (value == null || value === '') return '-'
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatRecargos = (tariff) => {
    const parts = []
    if (tariff.recargo_combustible_pct) parts.push(`Comb: ${tariff.recargo_combustible_pct}%`)
    if (tariff.recargo_seguro_pct) parts.push(`Seguro: ${tariff.recargo_seguro_pct}%`)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  const formatVigencia = (tariff) => {
    const desde = tariff.vigencia_desde ? new Date(tariff.vigencia_desde).toLocaleDateString() : null
    const hasta = tariff.vigencia_hasta ? new Date(tariff.vigencia_hasta).toLocaleDateString() : null
    if (desde && hasta) return `${desde} - ${hasta}`
    if (desde) return `Desde ${desde}`
    if (hasta) return `Hasta ${hasta}`
    return 'Indefinida'
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DollarSign sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={600}>
            {t('tms_tariffs_title', 'Reglas de Tarifas')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" startIcon={<Plus />} onClick={handleOpenCreate}>
            {t('tms_new_tariff', 'Nueva Tarifa')}
          </Button>
          <IconButton onClick={loadTariffs} title={t('common_refresh', 'Refrescar')}>
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
                <TableCell sx={{ fontWeight: 600 }}>{t('tms_tariff_nombre', 'Nombre')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_tariff_km', 'Tarifa/km')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_tariff_kg', 'Tarifa/kg')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_tariff_m3', 'Tarifa/m3')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('tms_tariff_recargos', 'Recargos')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('tms_tariff_vigencia', 'Vigencia')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('tms_tariff_activa', 'Activa')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">{t('tms_col_acciones', 'Acciones')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(tariffs || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {t('tms_no_tariffs', 'No hay tarifas registradas')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (tariffs || []).map(tariff => (
                  <TableRow key={tariff.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{tariff.nombre}</Typography>
                    </TableCell>
                    <TableCell align="right">{formatCurrency(tariff.tarifa_km)}</TableCell>
                    <TableCell align="right">{formatCurrency(tariff.tarifa_kg)}</TableCell>
                    <TableCell align="right">{formatCurrency(tariff.tarifa_m3)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatRecargos(tariff)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatVigencia(tariff)}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={tariff.activa !== false ? 'Si' : 'No'}
                        size="small"
                        color={tariff.activa !== false ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenEdit(tariff)}>
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
          {editingTariff
            ? t('tms_edit_tariff', 'Editar Tarifa')
            : t('tms_new_tariff', 'Nueva Tarifa')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('tms_tariff_nombre', 'Nombre')}
              value={form.nombre}
              onChange={(e) => handleFieldChange('nombre', e.target.value)}
              fullWidth
              required
              autoComplete="off"
            />
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  label={t('tms_tariff_km', 'Tarifa/km')}
                  type="number"
                  value={form.tarifa_km}
                  onChange={(e) => handleFieldChange('tarifa_km', e.target.value)}
                  fullWidth
                  inputProps={{ step: '0.01' }}
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label={t('tms_tariff_kg', 'Tarifa/kg')}
                  type="number"
                  value={form.tarifa_kg}
                  onChange={(e) => handleFieldChange('tarifa_kg', e.target.value)}
                  fullWidth
                  inputProps={{ step: '0.01' }}
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label={t('tms_tariff_m3', 'Tarifa/m3')}
                  type="number"
                  value={form.tarifa_m3}
                  onChange={(e) => handleFieldChange('tarifa_m3', e.target.value)}
                  fullWidth
                  inputProps={{ step: '0.01' }}
                  autoComplete="off"
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_tariff_recargo_comb', 'Recargo Combustible (%)')}
                  type="number"
                  value={form.recargo_combustible_pct}
                  onChange={(e) => handleFieldChange('recargo_combustible_pct', e.target.value)}
                  fullWidth
                  inputProps={{ step: '0.1' }}
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_tariff_recargo_seguro', 'Recargo Seguro (%)')}
                  type="number"
                  value={form.recargo_seguro_pct}
                  onChange={(e) => handleFieldChange('recargo_seguro_pct', e.target.value)}
                  fullWidth
                  inputProps={{ step: '0.1' }}
                  autoComplete="off"
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_tariff_desde', 'Vigencia Desde')}
                  type="date"
                  value={form.vigencia_desde}
                  onChange={(e) => handleFieldChange('vigencia_desde', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('tms_tariff_hasta', 'Vigencia Hasta')}
                  type="date"
                  value={form.vigencia_hasta}
                  onChange={(e) => handleFieldChange('vigencia_hasta', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  autoComplete="off"
                />
              </Grid>
            </Grid>
            <FormControlLabel
              control={
                <Switch
                  checked={form.activa}
                  onChange={(e) => handleFieldChange('activa', e.target.checked)}
                />
              }
              label={t('tms_tariff_activa', 'Activa')}
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
