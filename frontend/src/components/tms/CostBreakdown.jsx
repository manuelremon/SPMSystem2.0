/**
 * CostBreakdown - Financial breakdown of trip costs
 */
import React from 'react'
import { Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Divider, Chip } from '@mui/material'

export default function CostBreakdown({ costs = [], settlement = null }) {
  const totalCosts = costs.reduce((sum, c) => sum + (c.monto || 0), 0)

  return (
    <Box>
      {/* Costs Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Concepto</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell align="right">Monto</TableCell>
              <TableCell>Moneda</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {costs.map((cost) => (
              <TableRow key={cost.id}>
                <TableCell>{cost.concepto}</TableCell>
                <TableCell>{cost.categoria_nombre || '-'}</TableCell>
                <TableCell align="right">${(cost.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{cost.moneda || 'MXN'}</TableCell>
                <TableCell>
                  <Chip
                    label={cost.estado_pago || 'pendiente'}
                    size="small"
                    color={cost.estado_pago === 'pagado' ? 'success' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
            {costs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  No hay costos registrados
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell colSpan={2} sx={{ fontWeight: 600 }}>Total Costos</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                ${totalCosts.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Settlement Summary */}
      {settlement && (
        <Paper sx={{ p: 2 }} variant="outlined">
          <Typography variant="subtitle2" gutterBottom>Cierre Financiero</Typography>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Typography variant="body2">Combustible:</Typography>
            <Typography variant="body2" align="right">${(settlement.costo_combustible || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Typography>

            <Typography variant="body2">Peajes:</Typography>
            <Typography variant="body2" align="right">${(settlement.costo_peajes || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Typography>

            <Typography variant="body2">Viaticos:</Typography>
            <Typography variant="body2" align="right">${(settlement.costo_viaticos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Typography>

            <Typography variant="body2">Otros:</Typography>
            <Typography variant="body2" align="right">${(settlement.costo_otros || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Typography>

            <Divider sx={{ gridColumn: '1 / -1' }} />

            <Typography variant="body2" fontWeight={600}>Total Gastos:</Typography>
            <Typography variant="body2" align="right" fontWeight={600}>
              ${(settlement.total_gastos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Typography>

            <Typography variant="body2" fontWeight={600}>Ingreso Flete:</Typography>
            <Typography variant="body2" align="right" fontWeight={600} color="primary">
              ${(settlement.ingreso_flete || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Typography>

            <Divider sx={{ gridColumn: '1 / -1' }} />

            <Typography variant="subtitle2">Margen Neto:</Typography>
            <Typography
              variant="subtitle2"
              align="right"
              color={settlement.margen_pct >= 15 ? 'success.main' : settlement.margen_pct >= 5 ? 'warning.main' : 'error.main'}
            >
              ${(settlement.margen_neto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ({(settlement.margen_pct || 0).toFixed(1)}%)
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  )
}
