import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, CircularProgress, Alert, IconButton, TablePagination, Grid, Card,
  CardContent
} from '@mui/material'
import { Receipt, RefreshCw, Eye, DollarSign, TrendingUp, TrendingDown } from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'
import { useTmsStore } from '../../store/tmsStore'

function getMarginColor(marginPct) {
  if (marginPct >= 15) return 'success.main'
  if (marginPct >= 5) return 'warning.main'
  return 'error.main'
}

function getMarginChipColor(marginPct) {
  if (marginPct >= 15) return 'success'
  if (marginPct >= 5) return 'warning'
  return 'error'
}

export default function TripSettlement() {
  const { t } = useI18n()
  const { settlements, settlementsTotal, fetchSettlements } = useTmsStore()

  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [selectedSettlement, setSelectedSettlement] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSettlements()
  }, [page, rowsPerPage])

  const loadSettlements = async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchSettlements({ page: page + 1, per_page: rowsPerPage })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (settlement) => {
    setSelectedSettlement(settlement)
    setDetailOpen(true)
  }

  const handleChangePage = (_event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const formatCurrency = (value) => {
    if (value == null) return '-'
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const calcMarginPct = (ingreso, total) => {
    if (!ingreso || ingreso === 0) return 0
    return ((ingreso - total) / ingreso) * 100
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Receipt sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={600}>
            {t('tms_settlements_title', 'Liquidacion de Viajes')}
          </Typography>
        </Box>
        <IconButton onClick={loadSettlements} title={t('common_refresh', 'Refrescar')}>
          <RefreshCw />
        </IconButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_sett_envio', 'Envio')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('tms_sett_fecha', 'Fecha')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_sett_combustible', 'Combustible')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_sett_peajes', 'Peajes')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_sett_viaticos', 'Viaticos')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_sett_otros', 'Otros')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_sett_total', 'Total')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_sett_ingreso', 'Ingreso')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">{t('tms_sett_margen', 'Margen')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">{t('tms_sett_margen_pct', 'Margen %')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">{t('tms_col_acciones', 'Acciones')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(settlements || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {t('tms_no_settlements', 'No hay liquidaciones registradas')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (settlements || []).map(sett => {
                    const total = (sett.combustible || 0) + (sett.peajes || 0) + (sett.viaticos || 0) + (sett.otros || 0)
                    const margen = (sett.ingreso || 0) - total
                    const marginPct = calcMarginPct(sett.ingreso, total)

                    return (
                      <TableRow key={sett.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(sett)}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {sett.shipment_codigo || `ENV-${sett.shipment_id}`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {sett.fecha ? new Date(sett.fecha).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(sett.combustible)}</TableCell>
                        <TableCell align="right">{formatCurrency(sett.peajes)}</TableCell>
                        <TableCell align="right">{formatCurrency(sett.viaticos)}</TableCell>
                        <TableCell align="right">{formatCurrency(sett.otros)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(total)}</TableCell>
                        <TableCell align="right">{formatCurrency(sett.ingreso)}</TableCell>
                        <TableCell align="right" sx={{ color: getMarginColor(marginPct), fontWeight: 600 }}>
                          {formatCurrency(margen)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={marginPct >= 0 ? <TrendingUp sx={{ fontSize: 16 }} /> : <TrendingDown sx={{ fontSize: 16 }} />}
                            label={`${marginPct.toFixed(1)}%`}
                            size="small"
                            color={getMarginChipColor(marginPct)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRowClick(sett) }}>
                            <Eye fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={settlementsTotal}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage={t('common_rows_per_page', 'Filas por pagina')}
            />
          </>
        )}
      </TableContainer>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt sx={{ color: 'primary.main' }} />
            {t('tms_settlement_detail', 'Detalle de Liquidacion')}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedSettlement && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('tms_sett_envio', 'Envio')}
                      </Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {selectedSettlement.shipment_codigo || `ENV-${selectedSettlement.shipment_id}`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('tms_sett_fecha', 'Fecha')}
                      </Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {selectedSettlement.fecha ? new Date(selectedSettlement.fecha).toLocaleDateString() : '-'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Table size="small" sx={{ mt: 2 }}>
                <TableBody>
                  <TableRow>
                    <TableCell>{t('tms_sett_combustible', 'Combustible')}</TableCell>
                    <TableCell align="right">{formatCurrency(selectedSettlement.combustible)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t('tms_sett_peajes', 'Peajes')}</TableCell>
                    <TableCell align="right">{formatCurrency(selectedSettlement.peajes)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t('tms_sett_viaticos', 'Viaticos')}</TableCell>
                    <TableCell align="right">{formatCurrency(selectedSettlement.viaticos)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{t('tms_sett_otros', 'Otros')}</TableCell>
                    <TableCell align="right">{formatCurrency(selectedSettlement.otros)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('tms_sett_total', 'Total Gastos')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCurrency(
                        (selectedSettlement.combustible || 0) +
                        (selectedSettlement.peajes || 0) +
                        (selectedSettlement.viaticos || 0) +
                        (selectedSettlement.otros || 0)
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t('tms_sett_ingreso', 'Ingreso')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {formatCurrency(selectedSettlement.ingreso)}
                    </TableCell>
                  </TableRow>
                  {(() => {
                    const totalGastos = (selectedSettlement.combustible || 0) + (selectedSettlement.peajes || 0) +
                      (selectedSettlement.viaticos || 0) + (selectedSettlement.otros || 0)
                    const margen = (selectedSettlement.ingreso || 0) - totalGastos
                    const marginPct = calcMarginPct(selectedSettlement.ingreso, totalGastos)
                    return (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>{t('tms_sett_margen', 'Margen')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: getMarginColor(marginPct) }}>
                          {formatCurrency(margen)} ({marginPct.toFixed(1)}%)
                        </TableCell>
                      </TableRow>
                    )
                  })()}
                </TableBody>
              </Table>
              {selectedSettlement.notas && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('tms_sett_notas', 'Notas')}
                  </Typography>
                  <Typography variant="body2">{selectedSettlement.notas}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>{t('common_close', 'Cerrar')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
