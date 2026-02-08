/**
 * ChartExportButton - Exportar gráficos como PNG
 *
 * Features:
 * - Captura toda la card completa
 * - Usa html2canvas para captura confiable
 */

import React, { useState, useCallback } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import DownloadIcon from '@mui/icons-material/Download'
import html2canvas from 'html2canvas'

/**
 * Exportar card como PNG
 */
async function exportCard(element, filename) {
  try {
    // Capturar elemento
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // Mejor calidad
      useCORS: true,
      logging: false,
      allowTaint: true,
      imageTimeout: 0,
      canvasWidth: element.offsetWidth,
      canvasHeight: element.offsetHeight,
    })

    // Descargar directamente desde dataURL
    const image = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)

    link.href = image
    link.download = `${filename}-${date}.png`
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    return true
  } catch (error) {
    console.error('Error al exportar:', error)
    throw error
  }
}

/**
 * Componente ChartExportButton
 */
export function ChartExportButton({
  chartRef,
  filename = 'chart',
  tooltip = 'Exportar como PNG',
  size = 'small',
  disabled = false,
}) {
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    if (!chartRef?.current || exporting) return

    setExporting(true)

    try {
      await exportCard(chartRef.current, filename)
    } catch (error) {
      console.error('Error:', error)
      alert(`Error al exportar: ${error.message}\n\nVerifica la consola para más detalles.`)
    } finally {
      setExporting(false)
    }
  }, [chartRef, filename, exporting])

  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          size={size}
          onClick={handleExport}
          disabled={disabled || exporting || !chartRef?.current}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            },
          }}
        >
          {exporting ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <DownloadIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default ChartExportButton
