import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Card, CardContent, Switch, FormControlLabel, IconButton, Alert, Paper, Grid,
  CircularProgress
} from '@mui/material'
import { ArrowLeft, Plus, Trash2, Truck, Save } from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore } from '../../store/tmsStore'

const TIPO_ENVIO_OPTIONS = [
  { value: 'FTL', label: 'FTL - Carga Completa' },
  { value: 'LTL', label: 'LTL - Carga Parcial' },
  { value: 'parcel', label: 'Paqueteria' },
  { value: 'express', label: 'Express' },
]

const TIPO_CARGA_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'granel', label: 'Granel' },
  { value: 'perecedero', label: 'Perecedero' },
  { value: 'peligroso', label: 'Peligroso' },
  { value: 'fragil', label: 'Fragil' },
]

const EMPTY_ITEM = {
  material_id: '',
  descripcion: '',
  cantidad: '',
  peso_kg: '',
  volumen_m3: '',
  valor_declarado: '',
}

export default function ShipmentCreate() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const createShipment = useTmsStore(s => s.createShipment)

  const [form, setForm] = useState({
    tipo: 'FTL',
    origen: '',
    destino: '',
    prioridad: 3,
    tipo_carga: 'general',
    fecha_programada: '',
    instrucciones: '',
    cadena_frio: false,
    hazmat: false,
  })
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addItem = () => {
    setItems(prev => [...prev, { ...EMPTY_ITEM }])
  }

  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setError(null)
    if (!form.origen || !form.destino) {
      setError(t('tms_error_required_fields', 'Origen y destino son obligatorios'))
      return
    }
    if (items.every(it => !it.descripcion && !it.material_id)) {
      setError(t('tms_error_min_item', 'Debe agregar al menos un item con descripcion o material'))
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        prioridad: Number(form.prioridad),
        items: items
          .filter(it => it.descripcion || it.material_id)
          .map(it => ({
            ...it,
            cantidad: it.cantidad ? Number(it.cantidad) : null,
            peso_kg: it.peso_kg ? Number(it.peso_kg) : null,
            volumen_m3: it.volumen_m3 ? Number(it.volumen_m3) : null,
            valor_declarado: it.valor_declarado ? Number(it.valor_declarado) : null,
          })),
      }
      const res = await createShipment(payload)
      if (res.ok) {
        navigate('/tms/shipments')
      } else {
        setError(res.error || t('tms_error_create', 'Error al crear el envio'))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/tms/shipments')}>
          <ArrowLeft />
        </IconButton>
        <Truck sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t('tms_create_shipment', 'Nuevo Envio')}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Shipment Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('tms_info_general', 'Informacion General')}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('tms_label_tipo', 'Tipo')}</InputLabel>
                <Select
                  value={form.tipo}
                  label={t('tms_label_tipo', 'Tipo')}
                  onChange={(e) => handleFieldChange('tipo', e.target.value)}
                >
                  {TIPO_ENVIO_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('tms_label_origen', 'Origen')}
                value={form.origen}
                onChange={(e) => handleFieldChange('origen', e.target.value)}
                fullWidth
                required
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('tms_label_destino', 'Destino')}
                value={form.destino}
                onChange={(e) => handleFieldChange('destino', e.target.value)}
                fullWidth
                required
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('tms_label_prioridad', 'Prioridad')}</InputLabel>
                <Select
                  value={form.prioridad}
                  label={t('tms_label_prioridad', 'Prioridad')}
                  onChange={(e) => handleFieldChange('prioridad', e.target.value)}
                >
                  <MenuItem value={1}>1 - Muy Baja</MenuItem>
                  <MenuItem value={2}>2 - Baja</MenuItem>
                  <MenuItem value={3}>3 - Media</MenuItem>
                  <MenuItem value={4}>4 - Alta</MenuItem>
                  <MenuItem value={5}>5 - Urgente</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('tms_label_tipo_carga', 'Tipo de Carga')}</InputLabel>
                <Select
                  value={form.tipo_carga}
                  label={t('tms_label_tipo_carga', 'Tipo de Carga')}
                  onChange={(e) => handleFieldChange('tipo_carga', e.target.value)}
                >
                  {TIPO_CARGA_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('tms_label_fecha_prog', 'Fecha Programada')}
                type="date"
                value={form.fecha_programada}
                onChange={(e) => handleFieldChange('fecha_programada', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('tms_label_instrucciones', 'Instrucciones Especiales')}
                value={form.instrucciones}
                onChange={(e) => handleFieldChange('instrucciones', e.target.value)}
                fullWidth
                multiline
                rows={3}
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.cadena_frio}
                    onChange={(e) => handleFieldChange('cadena_frio', e.target.checked)}
                  />
                }
                label={t('tms_label_cadena_frio', 'Cadena de Frio')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.hazmat}
                    onChange={(e) => handleFieldChange('hazmat', e.target.checked)}
                    color="error"
                  />
                }
                label={t('tms_label_hazmat', 'Material Peligroso (HAZMAT)')}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Items */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{t('tms_items', 'Items del Envio')}</Typography>
            <Button variant="outlined" size="small" startIcon={<Plus />} onClick={addItem}>
              {t('tms_add_item', 'Agregar Item')}
            </Button>
          </Box>

          {items.map((item, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('tms_item_number', 'Item')} #{idx + 1}
                </Typography>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeItem(idx)}
                  disabled={items.length <= 1}
                >
                  <Trash2 fontSize="small" />
                </IconButton>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={t('tms_item_material', 'Codigo Material')}
                    value={item.material_id}
                    onChange={(e) => handleItemChange(idx, 'material_id', e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="off"
                  />
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    label={t('tms_item_descripcion', 'Descripcion')}
                    value={item.descripcion}
                    onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="off"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={t('tms_item_cantidad', 'Cantidad')}
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="off"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={t('tms_item_peso', 'Peso (kg)')}
                    type="number"
                    value={item.peso_kg}
                    onChange={(e) => handleItemChange(idx, 'peso_kg', e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="off"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={t('tms_item_volumen', 'Volumen (m3)')}
                    type="number"
                    value={item.volumen_m3}
                    onChange={(e) => handleItemChange(idx, 'volumen_m3', e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="off"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={t('tms_item_valor', 'Valor Declarado')}
                    type="number"
                    value={item.valor_declarado}
                    onChange={(e) => handleItemChange(idx, 'valor_declarado', e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="off"
                  />
                </Grid>
              </Grid>
            </Paper>
          ))}
        </CardContent>
      </Card>

      {/* Submit */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={() => navigate('/tms/shipments')}>
          {t('common_cancel', 'Cancelar')}
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? t('common_saving', 'Guardando...') : t('tms_create_shipment', 'Crear Envio')}
        </Button>
      </Box>
      </Box>
    </Box>
  )
}
