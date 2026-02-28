import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Card, CardContent, Chip, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, CircularProgress, Alert, Grid, IconButton
} from '@mui/material'
import {
  ArrowLeft, Truck, Eye, Clock, DollarSign, CheckCircle, Package,
  MapPin, Plus, AlertTriangle
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore, useTmsCurrentShipment } from '../../store/tmsStore'
import * as tmsService from '../../services/tms'

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

const TRANSITIONS = {
  draft: ['confirmed'],
  confirmed: ['assigned', 'cancelled'],
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'incident'],
  incident: ['in_transit', 'cancelled'],
  delivered: ['settled'],
}

export default function ShipmentDetail() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const currentShipment = useTmsCurrentShipment()
  const fetchShipment = useTmsStore(s => s.fetchShipment)
  const transitionShipment = useTmsStore(s => s.transitionShipment)

  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState([])
  const [costs, setCosts] = useState([])
  const [costDialogOpen, setCostDialogOpen] = useState(false)
  const [newCost, setNewCost] = useState({ concepto: '', monto: '', tipo: 'variable' })
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchShipment(id)
      const [trackingRes, costsRes] = await Promise.allSettled([
        tmsService.getShipmentTracking(id),
        tmsService.getShipmentCosts(id),
      ])
      if (trackingRes.status === 'fulfilled' && trackingRes.value.ok) {
        setTracking(trackingRes.value.data || [])
      }
      if (costsRes.status === 'fulfilled' && costsRes.value.ok) {
        setCosts(costsRes.value.data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTransition = async (newEstado) => {
    const res = await transitionShipment(id, newEstado)
    if (!res.ok) setError(res.error || 'Error al cambiar estado')
  }

  const handleAddCost = async () => {
    try {
      const res = await tmsService.addShipmentCost(id, {
        concepto: newCost.concepto,
        monto: parseFloat(newCost.monto),
        tipo: newCost.tipo,
      })
      if (res.ok) {
        setCosts(prev => [...prev, res.data])
        setCostDialogOpen(false)
        setNewCost({ concepto: '', monto: '', tipo: 'variable' })
      }
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  const shipment = currentShipment
  if (!shipment) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('tms_shipment_not_found', 'Envio no encontrado')}</Alert>
      </Box>
    )
  }

  const availableTransitions = TRANSITIONS[shipment.estado] || []
  const totalCosts = costs.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0)

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/tms/shipments')}>
          <ArrowLeft />
        </IconButton>
        <Truck sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h5" fontWeight={600}>
          {shipment.codigo || `ENV-${shipment.id}`}
        </Typography>
        <Chip
          label={ESTADO_LABELS[shipment.estado] || shipment.estado}
          color={ESTADO_COLORS[shipment.estado] || 'default'}
        />
      </Box>

      {/* Action buttons */}
      {availableTransitions.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          {availableTransitions.map(est => (
            <Button
              key={est}
              variant="outlined"
              size="small"
              color={ESTADO_COLORS[est] === 'error' ? 'error' : 'primary'}
              onClick={() => handleTransition(est)}
            >
              {ESTADO_LABELS[est]}
            </Button>
          ))}
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('tms_tab_detail', 'Detalle')} icon={<Eye sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label={t('tms_tab_tracking', 'Tracking')} icon={<MapPin sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label={t('tms_tab_costs', 'Costos')} icon={<DollarSign sx={{ fontSize: 18 }} />} iconPosition="start" />
      </Tabs>

      {/* Tab: Detalle */}
      {tab === 0 && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('tms_info_general', 'Informacion General')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <InfoRow label={t('tms_label_tipo', 'Tipo')} value={shipment.tipo} />
                    <InfoRow label={t('tms_label_origen', 'Origen')} value={shipment.origen} />
                    <InfoRow label={t('tms_label_destino', 'Destino')} value={shipment.destino} />
                    <InfoRow label={t('tms_label_tipo_carga', 'Tipo Carga')} value={shipment.tipo_carga} />
                    <InfoRow
                      label={t('tms_label_cadena_frio', 'Cadena de Frio')}
                      value={shipment.cadena_frio ? 'Si' : 'No'}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <InfoRow label={t('tms_label_prioridad', 'Prioridad')} value={shipment.prioridad} />
                    <InfoRow
                      label={t('tms_label_fecha_prog', 'Fecha Programada')}
                      value={shipment.fecha_programada ? new Date(shipment.fecha_programada).toLocaleDateString() : '-'}
                    />
                    <InfoRow
                      label={t('tms_label_hazmat', 'Material Peligroso')}
                      value={shipment.hazmat ? 'Si' : 'No'}
                    />
                    <InfoRow label={t('tms_label_vehiculo', 'Vehiculo')} value={shipment.vehiculo_id || '-'} />
                    <InfoRow label={t('tms_label_conductor', 'Conductor')} value={shipment.conductor_id || '-'} />
                  </Box>
                </Grid>
              </Grid>
              {shipment.instrucciones && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('tms_label_instrucciones', 'Instrucciones')}
                  </Typography>
                  <Typography variant="body2">{shipment.instrucciones}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Package sx={{ fontSize: 20, mr: 1, verticalAlign: 'text-bottom' }} />
                {t('tms_items', 'Items del Envio')}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('tms_item_material', 'Material')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t('tms_item_descripcion', 'Descripcion')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_item_cantidad', 'Cantidad')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_item_peso', 'Peso (kg)')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_item_volumen', 'Vol. (m3)')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_item_valor', 'Valor')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(shipment.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                          <Typography color="text.secondary">{t('tms_no_items', 'Sin items')}</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (shipment.items || []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.material_id || '-'}</TableCell>
                          <TableCell>{item.descripcion || '-'}</TableCell>
                          <TableCell align="right">{item.cantidad ?? '-'}</TableCell>
                          <TableCell align="right">{item.peso_kg ?? '-'}</TableCell>
                          <TableCell align="right">{item.volumen_m3 ?? '-'}</TableCell>
                          <TableCell align="right">
                            {item.valor_declarado != null ? `$${Number(item.valor_declarado).toLocaleString()}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab: Tracking */}
      {tab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <MapPin sx={{ fontSize: 20, mr: 1, verticalAlign: 'text-bottom' }} />
              {t('tms_tracking_title', 'Historial de Tracking')}
            </Typography>
            {tracking.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                {t('tms_no_tracking', 'Sin eventos de tracking')}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {tracking.map((event, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {event.tipo === 'incident' ? (
                        <AlertTriangle sx={{ color: 'error.main' }} />
                      ) : event.tipo === 'delivered' ? (
                        <CheckCircle sx={{ color: 'success.main' }} />
                      ) : (
                        <Clock sx={{ color: 'info.main' }} />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                          {event.titulo || event.tipo || 'Evento'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {event.descripcion || '-'}
                        </Typography>
                        {event.ubicacion && (
                          <Typography variant="caption" color="text.secondary">
                            <MapPin sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
                            {event.ubicacion}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {event.fecha ? new Date(event.fecha).toLocaleString() : '-'}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Costos */}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                <DollarSign sx={{ fontSize: 20, mr: 1, verticalAlign: 'text-bottom' }} />
                {t('tms_costs_title', 'Costos del Envio')}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Plus />}
                onClick={() => setCostDialogOpen(true)}
              >
                {t('tms_add_cost', 'Agregar Costo')}
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('tms_cost_concepto', 'Concepto')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t('tms_cost_tipo', 'Tipo')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_cost_monto', 'Monto')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {costs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">{t('tms_no_costs', 'Sin costos registrados')}</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    costs.map((cost, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{cost.concepto}</TableCell>
                        <TableCell>
                          <Chip label={cost.tipo} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">${Number(cost.monto).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {costs.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} sx={{ fontWeight: 600 }}>{t('tms_total', 'Total')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ${totalCosts.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Add Cost Dialog */}
      <Dialog open={costDialogOpen} onClose={() => setCostDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('tms_add_cost', 'Agregar Costo')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('tms_cost_concepto', 'Concepto')}
              value={newCost.concepto}
              onChange={(e) => setNewCost(prev => ({ ...prev, concepto: e.target.value }))}
              fullWidth
              autoComplete="off"
            />
            <TextField
              label={t('tms_cost_monto', 'Monto')}
              type="number"
              value={newCost.monto}
              onChange={(e) => setNewCost(prev => ({ ...prev, monto: e.target.value }))}
              fullWidth
              autoComplete="off"
            />
            <FormControl fullWidth>
              <InputLabel>{t('tms_cost_tipo', 'Tipo')}</InputLabel>
              <Select
                value={newCost.tipo}
                label={t('tms_cost_tipo', 'Tipo')}
                onChange={(e) => setNewCost(prev => ({ ...prev, tipo: e.target.value }))}
              >
                <MenuItem value="fijo">Fijo</MenuItem>
                <MenuItem value="variable">Variable</MenuItem>
                <MenuItem value="extra">Extra</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCostDialogOpen(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleAddCost}
            disabled={!newCost.concepto || !newCost.monto}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
        {label}:
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value || '-'}
      </Typography>
    </Box>
  )
}
