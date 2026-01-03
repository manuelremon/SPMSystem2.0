/**
 * ExportButton - Boton de exportacion con dropdown de formatos
 *
 * Uso:
 * <ExportButton
 *   onExport={(formato) => exportService.exportSolicitudes({ formato })}
 *   label="Exportar"
 * />
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileSpreadsheet, FileText, FileType, ChevronDown, Loader2 } from '../ui/Icons'
import { Button } from '../ui/Button'

const FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: 'text-emerald-600' },
  { value: 'csv', label: 'CSV (.csv)', icon: FileText, color: 'text-blue-600' },
  { value: 'pdf', label: 'PDF (.pdf)', icon: FileType, color: 'text-red-600' }
]

/**
 * @param {Object} props
 * @param {Function} props.onExport - Funcion async que recibe formato y ejecuta export
 * @param {string} props.label - Texto del boton (default: "Exportar")
 * @param {string[]} props.formats - Formatos disponibles (default: todos)
 * @param {string} props.defaultFormat - Formato por defecto (default: xlsx)
 * @param {boolean} props.disabled - Deshabilitar boton
 * @param {string} props.size - Tamano del boton (sm, md, lg)
 * @param {string} props.variant - Variante del boton
 */
export function ExportButton({
  onExport,
  label = 'Exportar',
  formats = ['xlsx', 'csv', 'pdf'],
  defaultFormat = 'xlsx',
  disabled = false,
  size = 'sm',
  variant = 'outline'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportingFormat, setExportingFormat] = useState(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  // Calcular posicion del dropdown
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 192 // 192px = w-48
      })
    }
  }, [isOpen])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtrar opciones disponibles
  const availableOptions = FORMAT_OPTIONS.filter(opt => formats.includes(opt.value))

  // Manejar export
  const handleExport = async (formato) => {
    if (isExporting) return

    setIsExporting(true)
    setExportingFormat(formato)
    setIsOpen(false)

    try {
      await onExport(formato)
    } catch (error) {
      console.error('Error exporting:', error)
    } finally {
      setIsExporting(false)
      setExportingFormat(null)
    }
  }

  // Si solo hay un formato, mostrar boton simple
  if (availableOptions.length === 1) {
    const format = availableOptions[0]
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport(format.value)}
        disabled={disabled || isExporting}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {label}
      </Button>
    )
  }

  // Renderizar dropdown via portal para evitar problemas de z-index
  const dropdownMenu = isOpen && createPortal(
    <div
      ref={dropdownRef}
      className="fixed w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 99999
      }}
    >
      {availableOptions.map((option) => {
        const Icon = option.icon
        const isCurrentExporting = isExporting && exportingFormat === option.value

        return (
          <button
            key={option.value}
            onClick={() => handleExport(option.value)}
            disabled={isExporting}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50"
          >
            {isCurrentExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <Icon className={`w-4 h-4 ${option.color}`} />
            )}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )

  return (
    <div className="relative inline-block" ref={buttonRef}>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="min-w-[120px]"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {isExporting ? `Exportando...` : label}
        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {dropdownMenu}
    </div>
  )
}

export default ExportButton
