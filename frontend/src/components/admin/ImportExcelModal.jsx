/**
 * ImportExcelModal - Modal para importar Excel de datos temporales
 *
 * Permite a administradores importar archivos Excel para operar
 * MRP y Forecast con datos temporales.
 */

import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useI18n } from '../../context/i18n'
import { importExcel, previewExcel, downloadTemplate } from '../../services/tempData'
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Stack,
  Grid
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import DownloadIcon from '@mui/icons-material/Download'
import CloseIcon from '@mui/icons-material/Close'
import DescriptionIcon from '@mui/icons-material/Description'

/**
 * Estados del proceso de importacion
 */
const STEPS = {
  SELECT: 'select',
  PREVIEW: 'preview',
  IMPORTING: 'importing',
  SUCCESS: 'success',
  ERROR: 'error'
}

export function ImportExcelModal({ isOpen, onClose, onSuccess }) {
  const { t } = useI18n()
  const [step, setStep] = useState(STEPS.SELECT)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Reset al cerrar
  const handleClose = useCallback(() => {
    setStep(STEPS.SELECT)
    setFile(null)
    setPreviewData(null)
    setImportResult(null)
    setError(null)
    setLoading(false)
    onClose()
  }, [onClose])

  // Manejar archivo seleccionado
  const handleFileSelect = useCallback(async (selectedFile) => {
    if (!selectedFile) return

    // Validar extension
    const ext = selectedFile.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setError('Formato no soportado. Use archivos .xlsx o .xls')
      setStep(STEPS.ERROR)
      return
    }

    // Validar tamano (50MB maximo)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('Archivo muy grande. Maximo 50MB.')
      setStep(STEPS.ERROR)
      return
    }

    setFile(selectedFile)
    setLoading(true)
    setError(null)

    try {
      const result = await previewExcel(selectedFile)

      if (!result.ok) {
        setError(result.error || 'Error al validar el archivo')
        setStep(STEPS.ERROR)
        return
      }

      setPreviewData(result)
      setStep(STEPS.PREVIEW)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al procesar archivo')
      setStep(STEPS.ERROR)
    } finally {
      setLoading(false)
    }
  }, [])

  // Manejar drop de archivo
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  // Manejar drag over
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  // Manejar input file change
  const handleInputChange = useCallback((e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }, [handleFileSelect])

  // Ejecutar importacion
  const handleImport = useCallback(async () => {
    if (!file) return

    setLoading(true)
    setStep(STEPS.IMPORTING)

    try {
      const result = await importExcel(file)

      if (result.ok) {
        setImportResult(result)
        setStep(STEPS.SUCCESS)
        if (onSuccess) {
          onSuccess(result)
        }
      } else {
        setError(result.error || 'Error al importar')
        setStep(STEPS.ERROR)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al importar archivo')
      setStep(STEPS.ERROR)
    } finally {
      setLoading(false)
    }
  }, [file, onSuccess])

  // Descargar plantilla
  const handleDownloadTemplate = useCallback(async () => {
    try {
      await downloadTemplate()
    } catch (err) {
      setError('Error al descargar plantilla')
    }
  }, [])

  // Renderizar contenido segun paso
  const renderContent = () => {
    switch (step) {
      case STEPS.SELECT:
        return (
          <Stack spacing={3}>
            {/* Zona de drop */}
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: dragOver ? 'primary.main' : 'divider',
                bgcolor: dragOver ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover'
                }
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('excel-file-input').click()}
            >
              <input
                id="excel-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleInputChange}
                style={{ display: 'none' }}
              />

              <Stack alignItems="center" spacing={1.5}>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />

                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    Arrastra tu archivo Excel aqui
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    o haz click para seleccionar
                  </Typography>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Formatos: .xlsx, .xls (max 50MB)
                </Typography>
              </Stack>
            </Paper>

            {/* Info sobre estructura */}
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                Estructura requerida del Excel:
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.5 } }}>
                <Typography component="li" variant="body2" color="text.secondary">
                  <strong>Hoja &quot;stock&quot;</strong>: material, descripcion, centro, almacen, stock, um
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  <strong>Hoja &quot;consumo_historico&quot;</strong>: material, fecha, cantidad
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  <strong>Hoja &quot;parametros_mrp&quot;</strong> (opcional): material, stock_seguridad, punto_pedido
                </Typography>
              </Box>
            </Paper>

            {/* Descargar plantilla */}
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadTemplate}
                >
                  Descargar Plantilla
                </Button>
              }
            >
              <Typography variant="body2" fontWeight="medium">
                Primera vez?
              </Typography>
              <Typography variant="body2">
                Descarga la plantilla para completar antes de importar
              </Typography>
            </Alert>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            )}
          </Stack>
        )

      case STEPS.PREVIEW:
        return (
          <Stack spacing={3}>
            {/* Archivo seleccionado */}
            <Paper sx={{ p: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {file?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(file?.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            </Paper>

            {/* Resumen */}
            {previewData?.resumen && (
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {previewData.resumen.materiales || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Materiales
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {previewData.resumen.registros_stock || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Registros Stock
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {previewData.resumen.registros_consumo || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Registros Consumo
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Errores */}
            {previewData?.errores?.length > 0 && (
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  Errores encontrados:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {previewData.errores.map((err, i) => (
                    <Typography component="li" variant="body2" key={i}>
                      {err}
                    </Typography>
                  ))}
                </Box>
              </Alert>
            )}

            {/* Advertencias */}
            {previewData?.advertencias?.length > 0 && (
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  Advertencias:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {previewData.advertencias.map((warn, i) => (
                    <Typography component="li" variant="body2" key={i}>
                      {warn}
                    </Typography>
                  ))}
                </Box>
              </Alert>
            )}

            {/* Preview de datos */}
            {previewData?.preview?.stock?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                  Vista previa (primeros 5 registros):
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Material</TableCell>
                        <TableCell>Descripcion</TableCell>
                        <TableCell align="right">Stock</TableCell>
                        <TableCell>Centro</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.preview.stock.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.material}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{row.descripcion}</TableCell>
                          <TableCell align="right">{row.stock}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{row.centro}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Stack>
        )

      case STEPS.IMPORTING:
        return (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 4 }}>
            <CircularProgress size={48} />
            <Typography variant="body1">
              Importando datos...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Esto puede tomar unos segundos
            </Typography>
          </Stack>
        )

      case STEPS.SUCCESS:
        return (
          <Stack spacing={3}>
            <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
              <Typography variant="h6" fontWeight="semibold">
                Modo Temporal Activado
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Los modulos MRP y Forecast ahora usaran los datos importados.
              </Typography>
            </Stack>

            {/* Resumen de importacion */}
            {importResult?.resumen && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="h6" color="primary" fontWeight="bold">
                      {importResult.resumen.materiales}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Materiales importados
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="h6" color="primary" fontWeight="bold">
                      {importResult.resumen.registros_consumo}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Registros de consumo
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {importResult?.advertencias?.length > 0 && (
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  Advertencias:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {importResult.advertencias.map((warn, i) => (
                    <Typography component="li" variant="body2" key={i}>
                      {warn}
                    </Typography>
                  ))}
                </Box>
              </Alert>
            )}
          </Stack>
        )

      case STEPS.ERROR:
        return (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 4 }}>
            <ErrorIcon color="error" sx={{ fontSize: 64 }} />
            <Typography variant="h6" fontWeight="semibold">
              Error al procesar
            </Typography>
            <Typography variant="body2" color="error" textAlign="center">
              {error}
            </Typography>
          </Stack>
        )

      default:
        return null
    }
  }

  // Renderizar footer segun paso
  const renderFooter = () => {
    switch (step) {
      case STEPS.SELECT:
        return (
          <Button variant="outlined" onClick={handleClose}>
            Cancelar
          </Button>
        )

      case STEPS.PREVIEW:
        return (
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setStep(STEPS.SELECT)
                setFile(null)
                setPreviewData(null)
              }}
            >
              Seleccionar otro archivo
            </Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={!previewData?.valid || loading}
            >
              {loading ? 'Importando...' : 'Activar Modo Temporal'}
            </Button>
          </>
        )

      case STEPS.SUCCESS:
        return (
          <Button variant="contained" onClick={handleClose}>
            Cerrar
          </Button>
        )

      case STEPS.ERROR:
        return (
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setStep(STEPS.SELECT)
                setFile(null)
                setError(null)
              }}
            >
              Intentar de nuevo
            </Button>
            <Button variant="contained" onClick={handleClose}>
              Cerrar
            </Button>
          </>
        )

      default:
        return null
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={step !== STEPS.IMPORTING ? handleClose : undefined}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon color="primary" />
          <Typography variant="h6">Importar Datos Temporales (Excel)</Typography>
        </Box>
        {step !== STEPS.IMPORTING && (
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {renderContent()}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {renderFooter()}
      </DialogActions>
    </Dialog>
  )
}

ImportExcelModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
}

export default ImportExcelModal
