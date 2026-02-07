/**
 * SPMAgGrid - Wrapper de AG Grid con estilos SPM
 *
 * Grid de datos de alto rendimiento basado en AG Grid Community
 * Diseñado para datasets grandes (28K+ filas) con virtualización nativa
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import * as XLSX from 'xlsx';

// Registrar módulos de AG Grid Community (requerido en v35+)
ModuleRegistry.registerModules([AllCommunityModule]);

// Estilos AG Grid
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './SPMAgGrid.css';

// Localización en español
const AG_GRID_LOCALE_ES = {
  // Filtros
  filterOoo: 'Filtrar...',
  equals: 'Igual a',
  notEqual: 'Diferente de',
  lessThan: 'Menor que',
  greaterThan: 'Mayor que',
  lessThanOrEqual: 'Menor o igual',
  greaterThanOrEqual: 'Mayor o igual',
  inRange: 'En rango',
  contains: 'Contiene',
  notContains: 'No contiene',
  startsWith: 'Empieza con',
  endsWith: 'Termina con',
  blank: 'Vacío',
  notBlank: 'No vacío',
  andCondition: 'Y',
  orCondition: 'O',
  applyFilter: 'Aplicar',
  resetFilter: 'Limpiar',
  clearFilter: 'Limpiar',

  // Paginación
  page: 'Página',
  more: 'Más',
  to: 'a',
  of: 'de',
  next: 'Siguiente',
  pageLast: 'Última',
  pageFirst: 'Primera',
  previous: 'Anterior',
  pageSizeSelectorLabel: 'Filas por página:',
  pageOf: 'Página ${page} de ${totalPages}',

  // Filas
  noRowsToShow: 'Sin datos para mostrar',
  loadingOoo: 'Cargando...',

  // Columnas
  columns: 'Columnas',
  pinColumn: 'Fijar columna',
  pinLeft: 'Fijar a la izquierda',
  pinRight: 'Fijar a la derecha',
  noPin: 'No fijar',
  autosizeThisColumn: 'Ajustar tamaño',
  autosizeAllColumns: 'Ajustar todas',
  resetColumns: 'Resetear columnas',

  // Ordenamiento
  sortAscending: 'Ordenar ascendente',
  sortDescending: 'Ordenar descendente',
  sortUnSort: 'Quitar orden',

  // Menú
  columnMenuLabel: 'Menú',

  // Selección
  selectAll: 'Seleccionar todo',
  searchOoo: 'Buscar...',
  selectAllSearchResults: 'Seleccionar resultados',

  // Pivot/Agrupación
  sum: 'Suma',
  min: 'Mínimo',
  max: 'Máximo',
  avg: 'Promedio',
  count: 'Conteo',
  first: 'Primero',
  last: 'Último',

  // Otros
  copy: 'Copiar',
  copyWithHeaders: 'Copiar con encabezados',
  ctrlC: 'Ctrl+C',
  paste: 'Pegar',
  ctrlV: 'Ctrl+V',
  export: 'Exportar',
  csvExport: 'Exportar CSV',
  excelExport: 'Exportar Excel',
};

/**
 * SPMAgGrid - Grid de datos con AG Grid
 *
 * @param {Array} rowData - Datos a mostrar (array de objetos)
 * @param {Array} columnDefs - Definición de columnas (formato AG Grid)
 * @param {boolean} loading - Estado de carga
 * @param {string|number} height - Altura del grid (default: 520)
 * @param {boolean} pagination - Habilitar paginación
 * @param {number} paginationPageSize - Filas por página (default: 25)
 * @param {Array} paginationPageSizeSelector - Opciones de tamaño de página
 * @param {boolean} enableQuickFilter - Mostrar búsqueda rápida
 * @param {function} onRowClick - Callback al hacer clic en una fila
 * @param {function} onRowDoubleClick - Callback al hacer doble clic
 * @param {function} onSelectionChanged - Callback cuando cambia la selección
 * @param {string} rowSelection - Tipo de selección: 'single' | 'multiple' | undefined
 * @param {string} exportFileName - Nombre base del archivo de exportación
 * @param {string} emptyMessage - Mensaje cuando no hay datos
 * @param {object} defaultColDef - Configuración por defecto de columnas
 * @param {object} gridOptions - Opciones adicionales de AG Grid
 * @param {object} sx - Estilos MUI adicionales para el contenedor
 */
export function SPMAgGrid({
  rowData = [],
  columnDefs = [],
  loading = false,
  height = 520,
  pagination = true,
  paginationPageSize = 25,
  paginationPageSizeSelector = [10, 25, 50, 100],
  enableQuickFilter = true,
  onRowClick,
  onRowDoubleClick,
  onSelectionChanged,
  rowSelection,
  exportFileName = 'datos',
  emptyMessage = 'Sin datos para mostrar',
  defaultColDef: customDefaultColDef,
  gridOptions = {},
  getRowId: customGetRowId,
  sx,
  ...props
}) {
  const gridRef = useRef(null);

  // Smart default para getRowId: usa data.id si existe para evitar
  // warnings de "duplicate node id" en AG Grid
  const hasIdField = rowData?.length > 0 && rowData[0]?.id != null;
  const getRowId = useMemo(() => {
    if (customGetRowId !== undefined) return customGetRowId;
    if (hasIdField) return (params) => String(params.data.id);
    return undefined;
  }, [customGetRowId, hasIdField]);

  // Configuración por defecto de columnas
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
    flex: 1,
    filterParams: {
      buttons: ['reset', 'apply'],
      closeOnApply: true,
    },
    ...customDefaultColDef,
  }), [customDefaultColDef]);

  // Handler para clic en fila
  const handleRowClicked = useCallback((event) => {
    if (onRowClick) {
      onRowClick(event.data, event);
    }
  }, [onRowClick]);

  // Handler para doble clic en fila
  const handleRowDoubleClicked = useCallback((event) => {
    if (onRowDoubleClick) {
      onRowDoubleClick(event.data, event);
    }
  }, [onRowDoubleClick]);

  // Exportar a XLSX
  const handleExportXLSX = useCallback(() => {
    if (!gridRef.current?.api) return;

    // Obtener datos visibles (respetando filtros)
    const displayedRows = [];
    gridRef.current.api.forEachNodeAfterFilterAndSort((node) => {
      displayedRows.push(node.data);
    });

    // Preparar datos para exportar
    const exportData = displayedRows.map(row => {
      const rowData = {};
      columnDefs.forEach(col => {
        if (col.field) {
          const header = col.headerName || col.field;
          let value = row[col.field];

          // Si hay valueGetter, usarlo
          if (col.valueGetter && typeof col.valueGetter === 'function') {
            try {
              value = col.valueGetter({ data: row, node: { data: row } });
            } catch (e) {
              value = row[col.field];
            }
          }

          // Si hay valueFormatter, usarlo
          if (col.valueFormatter && typeof col.valueFormatter === 'function') {
            try {
              value = col.valueFormatter({ value, data: row });
            } catch (e) {
              // Mantener valor original
            }
          }

          rowData[header] = value ?? '';
        }
      });
      return rowData;
    });

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');

    // Descargar archivo
    const fileName = `${exportFileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [columnDefs, exportFileName]);

  // Mensaje cuando no hay datos
  const overlayNoRowsTemplate = useMemo(() => (
    `<div style="padding: 20px; text-align: center; color: var(--fg-muted);">
      <span>${emptyMessage}</span>
    </div>`
  ), [emptyMessage]);

  // Mensaje de carga
  const overlayLoadingTemplate = useMemo(() => (
    `<div style="padding: 20px; text-align: center; color: var(--fg-muted);">
      <span>Cargando...</span>
    </div>`
  ), []);

  // Normalizar altura
  const normalizedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: normalizedHeight, minHeight: 200, ...sx }}>
      {/* Toolbar */}
      {enableQuickFilter && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            p: 1,
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--bg-soft)',
            gap: 1,
          }}
        >
          <Tooltip title="Descargar XLSX">
            <IconButton
              onClick={handleExportXLSX}
              size="small"
              sx={{
                color: 'var(--success)',
                border: '1px solid var(--success)',
                borderRadius: '4px',
                padding: '4px 8px',
                '&:hover': {
                  backgroundColor: 'var(--success)',
                  color: 'var(--card)',
                },
              }}
            >
              <FileDownloadIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>XLSX</span>
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* AG Grid */}
      <Box
        className="ag-theme-alpine spm-ag-grid"
        sx={{
          flex: 1,
          width: '100%',
          height: '100%',
          minHeight: 200,
          '& .ag-root-wrapper': {
            height: '100%',
          },
        }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          localeText={AG_GRID_LOCALE_ES}
          pagination={pagination}
          paginationPageSize={paginationPageSize}
          paginationPageSizeSelector={paginationPageSizeSelector}
          rowSelection={rowSelection ? { mode: 'singleRow', enableClickSelection: true } : undefined}
          onRowClicked={handleRowClicked}
          onRowDoubleClicked={handleRowDoubleClicked}
          onSelectionChanged={onSelectionChanged}
          overlayNoRowsTemplate={overlayNoRowsTemplate}
          overlayLoadingTemplate={overlayLoadingTemplate}
          loading={loading}
          theme="legacy"
          rowBuffer={20}
          suppressCellFocus={true}
          animateRows={true}
          enableCellTextSelection={true}
          ensureDomOrder={true}
          {...gridOptions}
          {...props}
        />
      </Box>
    </Box>
  );
}

SPMAgGrid.propTypes = {
  rowData: PropTypes.array,
  columnDefs: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  pagination: PropTypes.bool,
  paginationPageSize: PropTypes.number,
  paginationPageSizeSelector: PropTypes.arrayOf(PropTypes.number),
  enableQuickFilter: PropTypes.bool,
  onRowClick: PropTypes.func,
  onRowDoubleClick: PropTypes.func,
  onSelectionChanged: PropTypes.func,
  rowSelection: PropTypes.oneOf(['single', 'multiple']),
  exportFileName: PropTypes.string,
  emptyMessage: PropTypes.string,
  defaultColDef: PropTypes.object,
  gridOptions: PropTypes.object,
  getRowId: PropTypes.func,
  sx: PropTypes.object,
};

export default SPMAgGrid;
