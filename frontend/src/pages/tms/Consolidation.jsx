import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Card, CardContent, Chip, Paper, Grid,
  CircularProgress, Alert, IconButton, LinearProgress
} from '@mui/material'
import {
  Boxes, Truck, RefreshCw, Sparkles, Plus, Trash2, ArrowRightRight
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore, useTmsShipments } from '../../store/tmsStore'
import * as tmsService from '../../services/tms'

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

export default function Consolidation() {
  const { t } = useI18n()
  const shipments = useTmsShipments()
  const consolidations = useTmsStore(s => s.consolidations)
  const suggestedConsolidations = useTmsStore(s => s.suggestedConsolidations)
  const fetchShipments = useTmsStore(s => s.fetchShipments)
  const fetchConsolidations = useTmsStore(s => s.fetchConsolidations)
  const fetchSuggestedConsolidations = useTmsStore(s => s.fetchSuggestedConsolidations)

  const [loading, setLoading] = useState(true)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchShipments({ estado: 'confirmed', tipo: 'LTL' }),
        fetchConsolidations(),
      ])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggest = async () => {
    setSuggesting(true)
    try {
      await fetchSuggestedConsolidations()
    } catch (err) {
      setError(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  const handleAddToConsolidation = async (consolidationId, shipmentId) => {
    try {
      const res = await tmsService.addShipmentToConsolidation(consolidationId, shipmentId)
      if (res.ok) {
        await loadData()
      } else {
        setError(res.error || 'Error al agregar envio')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRemoveFromConsolidation = async (consolidationId, shipmentId) => {
    try {
      const res = await tmsService.removeShipmentFromConsolidation(consolidationId, shipmentId)
      if (res.ok) {
        await loadData()
      } else {
        setError(res.error || 'Error al remover envio')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCreateConsolidation = async () => {
    try {
      const res = await tmsService.createConsolidation({
        nombre: `Consolidacion ${new Date().toLocaleDateString()}`,
      })
      if (res.ok) {
        await fetchConsolidations()
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

  const confirmedShipments = (shipments || []).filter(s => s.estado === 'confirmed')

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Boxes sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={600}>
            {t('tms_consolidation_title', 'Consolidacion LTL')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={suggesting ? <CircularProgress size={18} /> : <Sparkles />}
            onClick={handleSuggest}
            disabled={suggesting}
          >
            {t('tms_suggest_consolidation', 'Sugerir Consolidaciones')}
          </Button>
          <Button variant="outlined" startIcon={<Plus />} onClick={handleCreateConsolidation}>
            {t('tms_new_consolidation', 'Nueva Consolidacion')}
          </Button>
          <IconButton onClick={loadData} title={t('common_refresh', 'Refrescar')}>
            <RefreshCw />
          </IconButton>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Suggestions */}
      {suggestedConsolidations.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('tms_suggestions_found', 'Sugerencias de consolidacion encontradas')}
          </Typography>
          {suggestedConsolidations.map((sug, idx) => (
            <Typography key={idx} variant="body2">
              {sug.descripcion || `Grupo ${idx + 1}: ${(sug.shipment_ids || []).length} envios`}
              {sug.ahorro_estimado && ` - Ahorro estimado: $${Number(sug.ahorro_estimado).toLocaleString()}`}
            </Typography>
          ))}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left: Confirmed Shipments */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              <Truck sx={{ fontSize: 20, mr: 1, verticalAlign: 'text-bottom' }} />
              {t('tms_confirmed_shipments', 'Envios Confirmados')}
              <Chip label={confirmedShipments.length} size="small" sx={{ ml: 1 }} />
            </Typography>
            {confirmedShipments.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {t('tms_no_confirmed', 'No hay envios confirmados para consolidar')}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {confirmedShipments.map(shipment => (
                  <Card key={shipment.id} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle2">
                            {shipment.codigo || `ENV-${shipment.id}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {shipment.origen} <ArrowRightRight sx={{ fontSize: 14, mx: 0.5, verticalAlign: 'text-bottom' }} /> {shipment.destino}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            {shipment.peso_total && (
                              <Chip label={`${shipment.peso_total} kg`} size="small" variant="outlined" />
                            )}
                            {shipment.volumen_total && (
                              <Chip label={`${shipment.volumen_total} m3`} size="small" variant="outlined" />
                            )}
                          </Box>
                        </Box>
                        <Chip
                          label={ESTADO_LABELS[shipment.estado]}
                          size="small"
                          color="info"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right: Consolidations */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              <Boxes sx={{ fontSize: 20, mr: 1, verticalAlign: 'text-bottom' }} />
              {t('tms_consolidations', 'Consolidaciones')}
              <Chip label={consolidations.length} size="small" sx={{ ml: 1 }} />
            </Typography>
            {consolidations.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {t('tms_no_consolidations', 'No hay consolidaciones activas')}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {consolidations.map(consol => {
                  const utilization = consol.utilizacion_pct || 0
                  const utilizationColor = utilization >= 80 ? 'success' : utilization >= 50 ? 'warning' : 'error'

                  return (
                    <Card key={consol.id} variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight={500}>
                            {consol.nombre || `Consolidacion #${consol.id}`}
                          </Typography>
                          <Chip
                            label={consol.estado || 'abierta'}
                            size="small"
                            color={consol.estado === 'cerrada' ? 'secondary' : 'primary'}
                          />
                        </Box>
                        <Box sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t('tms_utilization', 'Utilizacion')}
                            </Typography>
                            <Typography variant="caption" fontWeight={600}>
                              {utilization.toFixed(0)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(utilization, 100)}
                            color={utilizationColor}
                            sx={{ height: 8, borderRadius: 3 }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {(consol.envios || []).map(envio => (
                            <Chip
                              key={envio.id || envio}
                              label={typeof envio === 'object' ? (envio.codigo || `ENV-${envio.id}`) : `ENV-${envio}`}
                              size="small"
                              onDelete={() => handleRemoveFromConsolidation(consol.id, typeof envio === 'object' ? envio.id : envio)}
                            />
                          ))}
                        </Box>
                        {consol.peso_total && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {t('tms_total_weight', 'Peso total')}: {consol.peso_total} kg
                            {consol.volumen_total && ` | ${t('tms_total_volume', 'Volumen')}: ${consol.volumen_total} m3`}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
