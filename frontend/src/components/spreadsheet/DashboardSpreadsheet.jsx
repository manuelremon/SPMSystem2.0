/**
 * DashboardSpreadsheet - Wrapper de Fortune Sheet para SPM
 *
 * Componente principal que renderiza la hoja de calculo interactiva
 * con soporte para formulas SPM personalizadas.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { useI18n } from '../../context/i18n';

// Estilos personalizados para integrar con el tema de SPM
const customStyles = {
  container: {
    width: '100%',
    height: '100%',
    minHeight: '500px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    backgroundColor: 'var(--surface)',
  },
};

/**
 * Transforma datos de Fortune Sheet al formato de guardado
 */
const transformForSave = (data) => {
  if (!data || !Array.isArray(data)) return [];

  return data.map((sheet) => ({
    name: sheet.name || 'Hoja 1',
    celldata: sheet.celldata || [],
    row: sheet.row || 100,
    column: sheet.column || 26,
    config: sheet.config || {},
    scrollLeft: sheet.scrollLeft || 0,
    scrollTop: sheet.scrollTop || 0,
    luckysheet_selection_range: sheet.luckysheet_selection_range || [],
    zoomRatio: sheet.zoomRatio || 1,
    status: sheet.status || 1,
    order: sheet.order || 0,
    index: sheet.index || 0,
  }));
};

/**
 * DashboardSpreadsheet Component
 */
export default function DashboardSpreadsheet({
  sheets = [],
  onSave,
  onChange,
  readOnly = false,
  height = '600px',
  showToolbar = true,
  showFormulaBar = true,
  showSheetTabs = true,
  className = '',
}) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const [workbookData, setWorkbookData] = useState([]);
  const [isReady, setIsReady] = useState(false);

  // Inicializar datos
  useEffect(() => {
    if (sheets && sheets.length > 0) {
      const formattedSheets = sheets.map((sheet, idx) => {
        const data = typeof sheet.data === 'string' ? JSON.parse(sheet.data) : sheet.data;
        return {
          name: sheet.nombre || data?.name || `Hoja ${idx + 1}`,
          index: idx,
          order: idx,
          status: idx === 0 ? 1 : 0,
          celldata: data?.celldata || [],
          row: data?.row || 100,
          column: data?.column || 26,
          config: data?.config || {},
          scrollLeft: data?.scrollLeft || 0,
          scrollTop: data?.scrollTop || 0,
          zoomRatio: data?.zoomRatio || 1,
        };
      });
      setWorkbookData(formattedSheets);
      setIsReady(true);
    } else {
      // Hoja por defecto
      setWorkbookData([
        {
          name: 'Hoja 1',
          index: 0,
          order: 0,
          status: 1,
          celldata: [],
          row: 100,
          column: 26,
          config: {},
          scrollLeft: 0,
          scrollTop: 0,
          zoomRatio: 1,
        },
      ]);
      setIsReady(true);
    }
  }, [sheets]);

  // Handler de cambios
  const handleChange = useCallback(
    (data) => {
      if (onChange && !readOnly) {
        const transformed = transformForSave(data);
        onChange(transformed);
      }
    },
    [onChange, readOnly]
  );

  // Handler de guardado (Ctrl+S)
  const handleSave = useCallback(() => {
    if (onSave && !readOnly) {
      const transformed = transformForSave(workbookData);
      onSave(transformed);
    }
  }, [onSave, readOnly, workbookData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (!isReady) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ ...customStyles.container, height }}
      >
        <div className="text-gray-500">{t('common_loading', 'Cargando...')}</div>
      </div>
    );
  }

  // Configuracion de Fortune Sheet
  const options = {
    data: workbookData,
    onChange: handleChange,
    lang: 'es', // Fortune Sheet soporta espanol
    showtoolbar: showToolbar && !readOnly,
    showinfobar: false,
    showsheetbar: showSheetTabs,
    showstatisticBar: false,
    sheetFormulaBar: showFormulaBar,
    allowEdit: !readOnly,
    allowCopy: true,
    showtoolbarConfig: {
      undoRedo: true,
      paintFormat: true,
      currencyFormat: true,
      percentageFormat: true,
      numberDecrease: true,
      numberIncrease: true,
      moreFormats: true,
      font: true,
      fontSize: true,
      bold: true,
      italic: true,
      strikethrough: true,
      underline: true,
      textColor: true,
      fillColor: true,
      border: true,
      mergeCell: true,
      horizontalAlignMode: true,
      verticalAlignMode: true,
      textWrapMode: true,
      textRotateMode: false,
      image: false,
      link: true,
      chart: false,
      postil: false,
      pivotTable: false,
      function: true,
      frozenMode: true,
      sortAndFilter: true,
      conditionalFormat: true,
      dataVerification: false,
      splitColumn: false,
      screenshot: false,
      findAndReplace: true,
      protection: false,
      print: false,
    },
    cellContextMenu: [
      'copy',
      'paste',
      'separator',
      'insertRow',
      'insertColumn',
      'deleteRow',
      'deleteColumn',
      'separator',
      'clear',
    ],
    hook: {
      cellUpdated: (cell, position, sheetIdx, ctx) => {
        // Hook para cuando una celda es actualizada
        if (onChange) {
          handleChange(ctx.luckysheetfile);
        }
      },
    },
  };

  return (
    <div
      ref={containerRef}
      className={`dashboard-spreadsheet ${className}`}
      style={{ ...customStyles.container, height }}
    >
      <Workbook {...options} />
    </div>
  );
}
