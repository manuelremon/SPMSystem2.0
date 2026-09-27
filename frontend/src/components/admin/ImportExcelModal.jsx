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
import { formatNumber } from '../../utils/formatters'

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
      setError(t('import_excel_err_formato', 'Formato no admitido. Usa archivos .xlsx o .xls.'))
      setStep(STEPS.ERROR)
      return
    }

    // Validar tamano (50MB maximo)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError(t('import_excel_err_tamano', 'El archivo es demasiado grande. Máximo: 50 MB.'))
      setStep(STEPS.ERROR)
      return
    }

    setFile(selectedFile)
    setLoading(true)
    setError(null)

    try {
      const result = await previewExcel(selectedFile)

      if (!result.ok) {
        setError(result.error || t('import_excel_err_validar', 'Error al validar el archivo'))
        setStep(STEPS.ERROR)
        return
      }

      setPreviewData(result)
      setStep(STEPS.PREVIEW)
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('import_excel_err_procesar', 'Error al procesar el archivo'))
      setStep(STEPS.ERROR)
    } finally {
      setLoading(false)
    }
  }, [t])

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
        setError(result.error || t('import_excel_err_importar', 'Error al importar'))
        setStep(STEPS.ERROR)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('import_excel_err_importar_archivo', 'Error al importar el archivo'))
      setStep(STEPS.ERROR)
    } finally {
      setLoading(false)
    }
  }, [file, onSuccess, t])

  // Descargar plantilla
  const handleDownloadTemplate = useCallback(async () => {
    try {
      await downloadTemplate()
    } catch (err) {
      setError(t('import_excel_err_plantilla', 'Error al descargar la plantilla'))
    }
  }, [t])

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
                    {t('import_excel_arrastra', 'Arrastra tu archivo Excel aquí')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('import_excel_o_clic', 'o haz clic para seleccionarlo')}
                  </Typography>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  {t('import_excel_formatos', 'Formatos: .xlsx, .xls (máx. 50 MB)')}
                </Typography>
              </Stack>
            </Paper>

            {/* Info sobre estructura */}
            <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                {t('import_excel_estructura', 'Estructura requerida del Excel')}
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.5 } }}>
                <Typography component="li" variant="body2" color="text.secondary">
                  <strong>{t('import_excel_hoja', 'Hoja')} &quot;stock&quot;</strong>: material, descripcion, centro, almacen, stock, um
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  <strong>{t('import_excel_hoja', 'Hoja')} &quot;consumo_historico&quot;</strong>: material, fecha, cantidad
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  <strong>{t('import_excel_hoja', 'Hoja')} &quot;parametros_mrp&quot;</strong> ({t('import_excel_opcional', 'opcional')}): material, stock_seguridad, punto_pedido
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
                  sx={{ textTransform: 'none' }}
                >
                  {t('import_excel_descargar_plantilla', 'Descargar plantilla')}
                </Button>
              }
            >
              <Typography variant="body2" fontWeight="medium">
                {t('import_excel_primera_vez', '¿Primera vez?')}
              </Typography>
              <Typography variant="body2">
                {t('import_excel_desc_plantilla', 'Descarga la plantilla y complétala antes de importar')}
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
                  {formatNumber((file?.size || 0) / 1024 / 1024, 2)} MB
                </Typography>
              </Box>
            </Paper>

            {/* Resumen */}
            {previewData?.resumen && (
              <Grid container spacing={2}>
                <Grid size={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {formatNumber(previewData.resumen.materiales || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('import_excel_materiales', 'Materiales')}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {formatNumber(previewData.resumen.registros_stock || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('import_excel_registros_stock', 'Registros de stock')}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {formatNumber(previewData.resumen.registros_consumo || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('import_excel_registros_consumo', 'Registros de consumo')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Errores */}
            {previewData?.errores?.length > 0 && (
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  {t('import_excel_errores', 'Errores encontrados')}
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
                  {t('import_excel_advertencias', 'Advertencias')}
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
                  {t('import_excel_vista_previa', 'Vista previa (primeros 5 registros)')}
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>{t('import_excel_col_material', 'Material')}</TableCell>
                        <TableCell>{t('common_descripcion', 'Descripción')}</TableCell>
                        <TableCell align="right">{t('import_excel_col_stock', 'Stock')}</TableCell>
                        <TableCell>{t('common_centro', 'Centro')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.preview.stock.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.material}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{row.descripcion}</TableCell>
                          <TableCell align="right">{formatNumber(row.stock ?? 0)}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{row.centro}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Stack>
        );

      case STEPS.IMPORTING:
        return (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 4 }}>
            <CircularProgress size={48} />
            <Typography variant="body1">
              {t('import_excel_importando_datos', 'Importando datos…')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('import_excel_puede_tardar', 'Esto puede tardar unos segundos')}
            </Typography>
          </Stack>
        )

      case STEPS.SUCCESS:
        return (
          <Stack spacing={3}>
            <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
              <Typography variant="h6" fontWeight={600}>
                {t('import_excel_modo_activado', 'Modo temporal activado')}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {t('import_excel_modo_desc', 'Los módulos MRP y Pronóstico ahora usarán los datos importados.')}
              </Typography>
            </Stack>

            {/* Resumen de importacion */}
            {importResult?.resumen && (
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="h6" color="primary" fontWeight="bold">
                      {formatNumber(importResult.resumen.materiales || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('import_excel_materiales_importados', 'Materiales importados')}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={6}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="h6" color="primary" fontWeight="bold">
                      {formatNumber(importResult.resumen.registros_consumo || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('import_excel_registros_consumo', 'Registros de consumo')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {importResult?.advertencias?.length > 0 && (
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  {t('import_excel_advertencias', 'Advertencias')}
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
        );

      case STEPS.ERROR:
        return (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 4 }}>
            <ErrorIcon color="error" sx={{ fontSize: 64 }} />
            <Typography variant="h6" fontWeight={600}>
              {t('import_excel_error_procesar', 'Error al procesar')}
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
          <Button variant="outlined" onClick={handleClose} sx={{ textTransform: 'none' }}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
        )

      case STEPS.PREVIEW:
        return (
          <>
            <Button
              variant="outlined"
              sx={{ textTransform: 'none' }}
              onClick={() => {
                setStep(STEPS.SELECT)
                setFile(null)
                setPreviewData(null)
              }}
            >
              {t('import_excel_otro_archivo', 'Seleccionar otro archivo')}
            </Button>
            <Button
              variant="contained"
              sx={{ textTransform: 'none' }}
              onClick={handleImport}
              disabled={!previewData?.valid || loading}
            >
              {loading ? t('import_excel_importando', 'Importando…') : t('import_excel_activar_modo', 'Activar modo temporal')}
            </Button>
          </>
        )

      case STEPS.SUCCESS:
        return (
          <Button variant="contained" onClick={handleClose} sx={{ textTransform: 'none' }}>
            {t('common_cerrar', 'Cerrar')}
          </Button>
        )

      case STEPS.ERROR:
        return (
          <>
            <Button
              variant="outlined"
              sx={{ textTransform: 'none' }}
              onClick={() => {
                setStep(STEPS.SELECT)
                setFile(null)
                setError(null)
              }}
            >
              {t('import_excel_reintentar', 'Intentar de nuevo')}
            </Button>
            <Button variant="contained" onClick={handleClose} sx={{ textTransform: 'none' }}>
              {t('common_cerrar', 'Cerrar')}
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
          <Typography variant="h6">{t('import_excel_titulo', 'Importar datos temporales (Excel)')}</Typography>
        </Box>
        {step !== STEPS.IMPORTING && (
          <IconButton onClick={handleClose} size="small" aria-label={t('common_cerrar', 'Cerrar')}>
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
