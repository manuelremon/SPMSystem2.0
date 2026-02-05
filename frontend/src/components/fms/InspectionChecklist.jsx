/**
 * InspectionChecklist - Pre/Post trip inspection checklist component
 */
import React, { useState } from 'react'
import { Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, ToggleButtonGroup, ToggleButton, TextField, Chip, Button } from '@mui/material'
import { CheckCircle2, X, Minus } from '../ui/Icons'

const CATEGORY_LABELS = {
  motor: 'Motor',
  llantas: 'Llantas',
  luces: 'Luces',
  frenos: 'Frenos',
  cabina: 'Cabina',
  seguridad: 'Seguridad',
  documentos: 'Documentos',
  carroceria: 'Carroceria',
  carga: 'Carga',
  general: 'General',
}

export default function InspectionChecklist({ items = [], onChange, readOnly = false }) {
  const groupedItems = items.reduce((acc, item, idx) => {
    const cat = item.categoria || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ ...item, _idx: idx })
    return acc
  }, {})

  const handleStateChange = (idx, newState) => {
    if (readOnly || !onChange) return
    const updated = [...items]
    updated[idx] = { ...updated[idx], estado: newState }
    onChange(updated)
  }

  const handleObservation = (idx, obs) => {
    if (readOnly || !onChange) return
    const updated = [...items]
    updated[idx] = { ...updated[idx], observacion: obs }
    onChange(updated)
  }

  return (
    <Box>
      {Object.entries(groupedItems).map(([cat, catItems]) => (
        <Paper key={cat} variant="outlined" sx={{ mb: 2 }}>
          <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2">{CATEGORY_LABELS[cat] || cat}</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell width={40} align="center">Critico</TableCell>
                  <TableCell width={180} align="center">Estado</TableCell>
                  <TableCell>Observacion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catItems.map((item) => (
                  <TableRow key={item._idx} sx={item.estado === 'mal' && item.es_critico ? { bgcolor: 'error.50' } : {}}>
                    <TableCell>{item.item_checklist || item.item}</TableCell>
                    <TableCell align="center">
                      {item.es_critico ? <Chip label="Si" size="small" color="error" variant="outlined" /> : null}
                    </TableCell>
                    <TableCell align="center">
                      {readOnly ? (
                        <Chip
                          label={item.estado === 'ok' ? 'OK' : item.estado === 'mal' ? 'MAL' : 'N/A'}
                          size="small"
                          color={item.estado === 'ok' ? 'success' : item.estado === 'mal' ? 'error' : 'default'}
                        />
                      ) : (
                        <ToggleButtonGroup
                          value={item.estado || 'na'}
                          exclusive
                          onChange={(e, val) => val && handleStateChange(item._idx, val)}
                          size="small"
                        >
                          <ToggleButton value="ok" color="success" sx={{ px: 1 }}>
                            <CheckCircle2 size={16} />
                          </ToggleButton>
                          <ToggleButton value="mal" color="error" sx={{ px: 1 }}>
                            <X size={16} />
                          </ToggleButton>
                          <ToggleButton value="na" sx={{ px: 1 }}>
                            <Minus size={16} />
                          </ToggleButton>
                        </ToggleButtonGroup>
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <Typography variant="caption">{item.observacion || ''}</Typography>
                      ) : (
                        <TextField
                          size="small"
                          variant="standard"
                          placeholder="Observacion..."
                          value={item.observacion || ''}
                          onChange={(e) => handleObservation(item._idx, e.target.value)}
                          fullWidth
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}
    </Box>
  )
}
