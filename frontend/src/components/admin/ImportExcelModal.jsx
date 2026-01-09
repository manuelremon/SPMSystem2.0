/**
 * ImportExcelModal - Modal para importar Excel de datos temporales
 *
 * Permite a administradores importar archivos Excel para operar
 * MRP y Forecast con datos temporales.
 */

import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useI18n } from '../../context/i18n'
import { importExcel, previewExcel, downloadTemplate } from '../../services/tempData'

/**
 * Estados del proceso de importación
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

    // Validar extensión
    const ext = selectedFile.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setError('Formato no soportado. Use archivos .xlsx o .xls')
      setStep(STEPS.ERROR)
      return
    }

    // Validar tamaño (50MB máximo)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('Archivo muy grande. Máximo 50MB.')
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

  // Ejecutar importación
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

  // Renderizar contenido según paso
  const renderContent = () => {
    switch (step) {
      case STEPS.SELECT:
        return (
          <div className="space-y-4">
            {/* Zona de drop */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200
                ${dragOver
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
                }
              `}
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
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3">
                <svg className="w-12 h-12 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>

                <div>
                  <p className="text-[var(--text-primary)] font-medium">
                    Arrastra tu archivo Excel aqui
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    o haz click para seleccionar
                  </p>
                </div>

                <p className="text-xs text-[var(--text-muted)]">
                  Formatos: .xlsx, .xls (max 50MB)
                </p>
              </div>
            </div>

            {/* Info sobre estructura */}
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-[var(--text-primary)]">
                Estructura requerida del Excel:
              </h4>
              <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                <li>
                  <strong>Hoja &quot;stock&quot;</strong>: material, descripcion, centro, almacen, stock, um
                </li>
                <li>
                  <strong>Hoja &quot;consumo_historico&quot;</strong>: material, fecha, cantidad
                </li>
                <li>
                  <strong>Hoja &quot;parametros_mrp&quot;</strong> (opcional): material, stock_seguridad, punto_pedido
                </li>
              </ul>
            </div>

            {/* Descargar plantilla */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-500">Primera vez?</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Descarga la plantilla para completar antes de importar
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleDownloadTemplate}
                  className="!bg-blue-500/20 !text-blue-500 hover:!bg-blue-500/30"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Descargar Plantilla
                </Button>
              </div>
            </div>

            {loading && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
              </div>
            )}
          </div>
        )

      case STEPS.PREVIEW:
        return (
          <div className="space-y-4">
            {/* Archivo seleccionado */}
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 flex items-center gap-3">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-medium text-[var(--text-primary)]">{file?.name}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {(file?.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            {/* Resumen */}
            {previewData?.resumen && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {previewData.resumen.materiales || 0}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Materiales</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {previewData.resumen.registros_stock || 0}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Registros Stock</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {previewData.resumen.registros_consumo || 0}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Registros Consumo</p>
                </div>
              </div>
            )}

            {/* Errores */}
            {previewData?.errores?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-medium text-red-500 mb-2">Errores encontrados:</h4>
                <ul className="text-sm text-red-400 list-disc list-inside space-y-1">
                  {previewData.errores.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Advertencias */}
            {previewData?.advertencias?.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-medium text-yellow-500 mb-2">Advertencias:</h4>
                <ul className="text-sm text-yellow-400 list-disc list-inside space-y-1">
                  {previewData.advertencias.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview de datos */}
            {previewData?.preview?.stock?.length > 0 && (
              <div>
                <h4 className="font-medium text-[var(--text-primary)] mb-2">
                  Vista previa (primeros 5 registros):
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-tertiary)]">
                      <tr>
                        <th className="px-3 py-2 text-left">Material</th>
                        <th className="px-3 py-2 text-left">Descripcion</th>
                        <th className="px-3 py-2 text-right">Stock</th>
                        <th className="px-3 py-2 text-left">Centro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview.stock.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-[var(--border)]">
                          <td className="px-3 py-2 text-[var(--text-primary)]">{row.material}</td>
                          <td className="px-3 py-2 text-[var(--text-secondary)]">{row.descripcion}</td>
                          <td className="px-3 py-2 text-right text-[var(--text-primary)]">{row.stock}</td>
                          <td className="px-3 py-2 text-[var(--text-muted)]">{row.centro}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )

      case STEPS.IMPORTING:
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
            <p className="text-[var(--text-primary)]">Importando datos...</p>
            <p className="text-sm text-[var(--text-muted)]">Esto puede tomar unos segundos</p>
          </div>
        )

      case STEPS.SUCCESS:
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-4 gap-3">
              <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                Modo Temporal Activado
              </h3>
              <p className="text-[var(--text-secondary)] text-center">
                Los modulos MRP y Forecast ahora usaran los datos importados.
              </p>
            </div>

            {/* Resumen de importación */}
            {importResult?.resumen && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                  <p className="text-lg font-bold text-[var(--accent)]">
                    {importResult.resumen.materiales}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Materiales importados</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                  <p className="text-lg font-bold text-[var(--accent)]">
                    {importResult.resumen.registros_consumo}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Registros de consumo</p>
                </div>
              </div>
            )}

            {importResult?.advertencias?.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-medium text-yellow-500 mb-2">Advertencias:</h4>
                <ul className="text-sm text-yellow-400 list-disc list-inside space-y-1">
                  {importResult.advertencias.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )

      case STEPS.ERROR:
        return (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">
              Error al procesar
            </h3>
            <p className="text-red-500 text-center">{error}</p>
          </div>
        )

      default:
        return null
    }
  }

  // Renderizar footer según paso
  const renderFooter = () => {
    switch (step) {
      case STEPS.SELECT:
        return (
          <Button variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
        )

      case STEPS.PREVIEW:
        return (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setStep(STEPS.SELECT)
                setFile(null)
                setPreviewData(null)
              }}
            >
              Seleccionar otro archivo
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!previewData?.valid || loading}
            >
              {loading ? 'Importando...' : 'Activar Modo Temporal'}
            </Button>
          </>
        )

      case STEPS.SUCCESS:
        return (
          <Button variant="primary" onClick={handleClose}>
            Cerrar
          </Button>
        )

      case STEPS.ERROR:
        return (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setStep(STEPS.SELECT)
                setFile(null)
                setError(null)
              }}
            >
              Intentar de nuevo
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Cerrar
            </Button>
          </>
        )

      default:
        return null
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importar Datos Temporales (Excel)"
      size="lg"
      footer={renderFooter()}
      closeOnOverlayClick={step !== STEPS.IMPORTING}
    >
      {renderContent()}
    </Modal>
  )
}

ImportExcelModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
}

export default ImportExcelModal
