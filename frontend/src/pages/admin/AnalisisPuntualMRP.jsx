/**
 * AnalisisPuntualMRP - MRP con datos temporales
 *
 * Muestra el tablero de alertas MRP utilizando datos importados desde Excel.
 * Reutiliza la logica de MRPTableroAlertas pero fuerza el uso de datos temporales.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { TempDataBanner } from '../../components/ui/TempDataBanner'
import { useI18n } from '../../context/i18n'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { SPMAgGrid } from '../../components/ui/SPMAgGrid'
import PageLayout from '../../components/ui/PageLayout'
import { formatNumber } from '../../utils/formatters'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Grid
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InventoryIcon from '@mui/icons-material/Inventory'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'

const ESTADO_LABELS = {
  SIN_STOCK: 'Sin stock',
  STOCK_CRITICO: 'Stock crítico',
  BAJO_PUNTO_PEDIDO: 'Bajo punto de pedido',
  BAJO_MINIMO: 'Bajo mínimo',
  STOCK_EXCEDIDO: 'Stock excedido',
  OK: 'OK',
}

const fmtQty = (v, empty = '—') => (v == null || v === '' ? empty : formatNumber(v))

/**
 * Componente tabla de alertas MRP migrado a SPMAgGrid
 */
function AlertasTable({ data, getEstadoColor }) {
  const { t } = useI18n()

  const rows = useMemo(() => {
    return data.map((alerta, idx) => ({
      ...alerta,
      id: idx,
    }))
  }, [data])

  const columnDefs = useMemo(() => [
    {
      field: 'material',
      headerName: t('common_material', 'Material'),
      flex: 0.5,
      minWidth: 100,
      cellStyle: {
        fontFamily: 'monospace',
      },
    },
    {
      field: 'descripcion',
      headerName: t('common_description', 'Descripción'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'stock_actual',
      headerName: t('mrp_stock', 'Stock'),
      flex: 0.4,
      minWidth: 100,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => fmtQty(params.value, '0'),
    },
    {
      field: 'stock_minimo',
      headerName: t('mrp_min', 'Mínimo'),
      flex: 0.4,
      minWidth: 100,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => fmtQty(params.value),
    },
    {
      field: 'punto_pedido',
      headerName: t('mrp_reorder_point', 'Punto de pedido'),
      flex: 0.4,
      minWidth: 100,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => fmtQty(params.value),
    },
    {
      field: 'estado',
      headerName: t('common_status', 'Estado'),
      flex: 0.5,
      minWidth: 120,
      valueFormatter: (params) => ESTADO_LABELS[params.value] || params.value || '—',
      cellRenderer: (params) => (
        <Chip
          label={t(`ap_mrp_estado_${(params.value || '').toLowerCase()}`, ESTADO_LABELS[params.value] || params.value?.replace(/_/g, ' ') || '—')}
          color={getEstadoColor(params.value)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'centro',
      headerName: t('common_center', 'Centro'),
      flex: 0.4,
      minWidth: 100,
    },
  ], [t, getEstadoColor])

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={500}
      pagination={true}
      paginationPageSize={25}
      enableQuickFilter={true}
      exportFileName="alertas_mrp"
      emptyMessage={t('common_no_data', 'Sin datos')}
    />
  )
}

export default function AnalisisPuntualMRP() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tempActive, setTempActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [resumen, setResumen] = useState({})

  // Si no hay datos temporales, redirigir a home
  useEffect(() => {
    if (!tempActive) {
      navigate('/admin/analisis-puntual')
    }
  }, [tempActive, navigate])

  // Cargar alertas MRP con datos temporales
  const fetchAlertas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/mrp/alertas', {
        params: { use_temp_data: true, limit: 100 }
      })
      if (response.data.ok) {
        setAlertas(response.data.alertas || [])
        setResumen(response.data.resumen || {})
      } else {
        const errData = response.data.error
        setError(typeof errData === 'object' ? (errData?.message || 'Error al cargar las alertas') : (errData || 'Error al cargar las alertas'))
      }
    } catch (err) {
      const errorData = err.response?.data?.error
      // Handle error object or string
      const errorMsg = typeof errorData === 'object'
        ? (errorData?.message || JSON.stringify(errorData))
        : (errorData || 'Error al cargar las alertas MRP')
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tempActive) {
      fetchAlertas()
    }
  }, [tempActive, fetchAlertas])

  const getEstadoColor = (estado) => {
    const estados = {
      'SIN_STOCK': 'error',
      'STOCK_CRITICO': 'warning',
      'BAJO_PUNTO_PEDIDO': 'warning',
      'BAJO_MINIMO': 'warning',
      'STOCK_EXCEDIDO': 'info',
      'OK': 'success',
    }
    return estados[estado] || 'default'
  }

  return (
    <PageLayout
      title={t('ap_mrp_titulo', 'MRP: alertas con datos temporales')}
      subtitle={t('ap_mrp_subtitulo', 'Análisis puntual · MRP temporal')}
      backTo="/admin/analisis-puntual"
      actions={
        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={fetchAlertas}
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          {t('common_actualizar', 'Actualizar')}
        </Button>
      }
    >
        {/* Banner siempre visible */}
        <TempDataBanner onStatusChange={setTempActive} />

        {/* Error */}
        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Loading */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Resumen Cards */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ p: 1, bgcolor: 'grey.100' }}>
                      <InventoryIcon sx={{ fontSize: 20, color: 'grey.600' }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" color="text.primary">
                        {formatNumber(resumen.total_materiales || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('ap_mrp_kpi_total', 'Total de materiales')}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ p: 1, bgcolor: 'error.light' }}>
                      <WarningAmberIcon sx={{ fontSize: 20, color: 'error.main' }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" color="error.main">
                        {formatNumber(resumen.sin_stock || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('ap_mrp_kpi_sin_stock', 'Sin stock')}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ p: 1, bgcolor: 'warning.light' }}>
                      <TrendingDownIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" color="warning.main">
                        {formatNumber(resumen.stock_critico || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('ap_mrp_kpi_critico', 'Stock crítico')}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ p: 1, bgcolor: 'warning.lighter' }}>
                      <WarningAmberIcon sx={{ fontSize: 20, color: 'warning.dark' }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" sx={{ color: 'warning.dark' }}>
                        {formatNumber(resumen.bajo_punto_pedido || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('ap_mrp_kpi_bajo_pp', 'Bajo punto de pedido')}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

            {/* Tabla de Alertas */}
            <Paper elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {t('mrp_alerts', 'Alertas de stock')} ({formatNumber(alertas.length)})
                </Typography>
              </Box>
              {alertas.length > 0 && (
                <AlertasTable data={alertas} getEstadoColor={getEstadoColor} />
              )}
              {alertas.length === 0 && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('ap_mrp_sin_alertas', 'No hay alertas de stock con los datos importados')}
                  </Typography>
                </Box>
              )}
            </Paper>
          </>
        )}
    </PageLayout>
  );
}
