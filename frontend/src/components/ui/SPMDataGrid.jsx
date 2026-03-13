import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SvgIcon from '@mui/material/SvgIcon';
import { DataGrid, GridToolbar, GridToolbarContainer } from '@mui/x-data-grid';
import * as XLSX from 'xlsx';

// Icono de descarga personalizado
const DownloadXlsxIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z" />
  </SvgIcon>
);

// Icono de búsqueda personalizado
const SearchIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </SvgIcon>
);

/**
 * SPMDataGrid - Wrapper de MUI DataGrid con estilos del sistema SPM
 *
 * Características:
 * - Estilos consistentes con variables CSS del sistema
 * - Toolbar con búsqueda rápida, filtros y exportación CSV
 * - Paginación configurable
 * - Soporte para ordenamiento y filtrado
 * - Localización en español
 *
 * @param {Object} props
 * @param {Array} props.rows - Datos a mostrar (requiere campo 'id')
 * @param {Array} props.columns - Definición de columnas (formato GridColDef)
 * @param {boolean} [props.loading=false] - Estado de carga
 * @param {number|string} [props.height=520] - Altura del contenedor
 * @param {'compact'|'standard'|'comfortable'} [props.density='standard'] - Densidad de filas
 * @param {boolean} [props.showToolbar=true] - Mostrar toolbar con filtros
 * @param {boolean} [props.disableRowSelectionOnClick=true] - Deshabilitar selección al hacer clic
 * @param {Object} [props.initialState] - Estado inicial del DataGrid
 * @param {Array<number>} [props.pageSizeOptions] - Opciones de tamaño de página
 * @param {Function} [props.getRowId] - Función para obtener ID de fila si no es 'id'
 * @param {string} [props.emptyMessage] - Mensaje cuando no hay datos
 */
export function SPMDataGrid({
  rows = [],
  columns = [],
  loading = false,
  height = 520,
  density = 'standard',
  showToolbar = true,
  disableRowSelectionOnClick = true,
  initialState = {},
  pageSizeOptions = [10, 25, 50, 100],
  getRowId,
  emptyMessage = 'Sin datos para mostrar',
  ...props
}) {
  // Estilos personalizados para integrar con el sistema de diseño SPM (Corporate Blue)
  const spmStyles = {
    height,
    width: '100%',
    '& .MuiDataGrid-root': {
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--surface)',
    },
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: 'var(--surface) !important',
      color: 'var(--fg-strong) !important',
      borderBottom: '2px solid var(--border)',
    },
    '& .MuiDataGrid-columnHeader': {
      backgroundColor: 'var(--surface) !important',
      color: 'var(--fg-strong) !important',
      borderRight: '1px solid var(--border) !important',
      '&:last-of-type': {
        borderRight: 'none !important',
      },
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 600,
      color: 'var(--fg-strong) !important',
      fontSize: '0.875rem',
      padding: '0 4px',
    },
    '& .MuiDataGrid-sortIcon': {
      color: 'var(--fg-muted) !important',
      fill: 'var(--fg-muted) !important',
      opacity: '1 !important',
    },
    '& .MuiDataGrid-sortIcon path': {
      fill: 'var(--fg-muted) !important',
    },
    '& .MuiDataGrid-menuIconButton': {
      color: 'var(--fg-muted) !important',
    },
    '& .MuiDataGrid-iconButtonContainer': {
      visibility: 'visible !important',
    },
    '& .MuiDataGrid-columnHeader svg': {
      color: 'var(--fg-muted) !important',
      fill: 'var(--fg-muted) !important',
    },
    '& .MuiDataGrid-columnHeader svg path': {
      fill: 'var(--fg-muted) !important',
    },
    '& .MuiDataGrid-cell': {
      borderBottom: '1px solid var(--border) !important',
      borderRight: '1px solid var(--border) !important',
      color: 'var(--fg-strong)',
      fontSize: '0.875rem',
      padding: '0 12px',
      '&:last-of-type': {
        borderRight: 'none !important',
      },
    },
    '& .MuiDataGrid-row': {
      '& .MuiDataGrid-cell': {
        borderRight: '1px solid var(--border) !important',
        '&:last-of-type': {
          borderRight: 'none !important',
        },
      },
    },
    '& .MuiDataGrid-row:hover': {
      backgroundColor: 'var(--bg-soft)',
    },
    '& .MuiDataGrid-row.Mui-selected': {
      backgroundColor: 'var(--primary-muted)',
      '&:hover': {
        backgroundColor: 'var(--primary-muted)',
      },
    },
    '& .MuiDataGrid-footerContainer': {
      borderTop: '1px solid var(--border)',
      backgroundColor: 'var(--bg-soft)',
    },
    '& .MuiDataGrid-toolbarContainer': {
      padding: 'var(--space-2) var(--space-4)',
      gap: 'var(--space-2)',
      borderBottom: '1px solid var(--border)',
    },
    '& .MuiButton-root': {
      textTransform: 'none',
      fontSize: '0.875rem',
    },
    '& .MuiDataGrid-overlay': {
      backgroundColor: 'var(--surface)',
    },
    '& .MuiTablePagination-root': {
      color: 'var(--fg-strong)',
    },
    '& .MuiDataGrid-columnSeparator': {
      display: 'none',
    },
    // Asegurar bordes visibles en todas las celdas
    '& .MuiDataGrid-virtualScroller': {
      '& .MuiDataGrid-cell': {
        borderRight: '1px solid var(--border) !important',
      },
    },
  };

  // Función para exportar a XLSX
  const handleExportXLSX = useCallback(() => {
    // Preparar datos para exportar
    const exportData = rows.map(row => {
      const rowData = {};
      columns.forEach(col => {
        const field = col.field;
        let value = row[field];

        // Si la columna tiene valueGetter, usarlo
        if (col.valueGetter) {
          try {
            value = col.valueGetter({ row, value });
          } catch (e) {
            value = row[field];
          }
        }

        // Usar headerName como nombre de columna
        const header = col.headerName || field;
        rowData[header] = value ?? '';
      });
      return rowData;
    });

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');

    // Descargar archivo
    const fileName = `export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [rows, columns]);

  // Toolbar personalizado con búsqueda y descarga XLSX
  const CustomToolbar = useCallback(() => (
    <GridToolbarContainer sx={{
      justifyContent: 'space-between',
      alignItems: 'center',
      p: 1,
      gap: 1,
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--bg-soft)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GridToolbar
          showQuickFilter
          quickFilterProps={{
            debounceMs: 300,
            placeholder: 'Buscar...',
          }}
          printOptions={{ disableToolbarButton: true }}
        />
      </Box>
      <Tooltip title="Descargar XLSX">
        <IconButton
          onClick={handleExportXLSX}
          size="medium"
          sx={{
            color: 'var(--primary)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            padding: '6px',
            '&:hover': {
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)'
            }
          }}
        >
          <DownloadXlsxIcon />
        </IconButton>
      </Tooltip>
    </GridToolbarContainer>
  ), [handleExportXLSX]);

  // Configuración de slots para toolbar (compatible con MUI DataGrid v6+)
  const slots = showToolbar ? { toolbar: CustomToolbar } : undefined;
  const components = showToolbar ? { Toolbar: CustomToolbar } : undefined;

  // Estado de paginación controlado
  const [paginationModel, setPaginationModel] = useState({
    pageSize: pageSizeOptions[0] || 10,
    page: 0,
  });

  // Merge del estado inicial con defaults
  const mergedInitialState = {
    ...initialState,
  };

  // Texto de localizacion personalizado (espanol)
  const localeText = {
    noRowsLabel: emptyMessage,
    noResultsOverlayLabel: 'No se encontraron resultados',
    toolbarQuickFilterPlaceholder: 'Buscar...',
    toolbarFilters: 'Filtros',
    toolbarFiltersLabel: 'Mostrar filtros',
    toolbarFiltersTooltipHide: 'Ocultar filtros',
    toolbarFiltersTooltipShow: 'Mostrar filtros',
    toolbarColumns: 'Columnas',
    toolbarColumnsLabel: 'Seleccionar columnas',
    toolbarDensity: 'Densidad',
    toolbarDensityLabel: 'Densidad',
    toolbarDensityCompact: 'Compacta',
    toolbarDensityStandard: 'Estándar',
    toolbarDensityComfortable: 'Cómoda',
    toolbarExport: 'Exportar',
    toolbarExportLabel: 'Exportar',
    toolbarExportCSV: 'Descargar CSV',
    toolbarExportPrint: 'Imprimir',
    filterPanelAddFilter: 'Agregar filtro',
    filterPanelRemoveAll: 'Eliminar todos',
    filterPanelDeleteIconLabel: 'Eliminar',
    filterPanelLogicOperator: 'Operador lógico',
    filterPanelOperator: 'Operador',
    filterPanelOperatorAnd: 'Y',
    filterPanelOperatorOr: 'O',
    filterPanelColumns: 'Columnas',
    filterPanelInputLabel: 'Valor',
    filterPanelInputPlaceholder: 'Valor del filtro',
    filterOperatorContains: 'contiene',
    filterOperatorDoesNotContain: 'no contiene',
    filterOperatorEquals: 'igual a',
    filterOperatorDoesNotEqual: 'diferente de',
    filterOperatorStartsWith: 'empieza con',
    filterOperatorEndsWith: 'termina con',
    filterOperatorIs: 'es',
    filterOperatorNot: 'no es',
    filterOperatorAfter: 'después de',
    filterOperatorOnOrAfter: 'en o después de',
    filterOperatorBefore: 'antes de',
    filterOperatorOnOrBefore: 'en o antes de',
    filterOperatorIsEmpty: 'está vacío',
    filterOperatorIsNotEmpty: 'no está vacío',
    filterOperatorIsAnyOf: 'es cualquiera de',
    columnMenuLabel: 'Menú',
    columnMenuShowColumns: 'Mostrar columnas',
    columnMenuManageColumns: 'Administrar columnas',
    columnMenuFilter: 'Filtrar',
    columnMenuHideColumn: 'Ocultar columna',
    columnMenuUnsort: 'Quitar orden',
    columnMenuSortAsc: 'Ordenar ascendente',
    columnMenuSortDesc: 'Ordenar descendente',
    columnHeaderFiltersTooltipActive: (count) =>
      count !== 1 ? `${count} filtros activos` : `${count} filtro activo`,
    columnHeaderFiltersLabel: 'Mostrar filtros',
    columnHeaderSortIconLabel: 'Ordenar',
    footerRowSelected: (count) =>
      count !== 1
        ? `${count.toLocaleString()} filas seleccionadas`
        : `${count.toLocaleString()} fila seleccionada`,
    footerTotalRows: 'Total de filas:',
    footerTotalVisibleRows: (visibleCount, totalCount) =>
      `${visibleCount.toLocaleString()} de ${totalCount.toLocaleString()}`,
    MuiTablePagination: {
      labelRowsPerPage: 'Filas por página:',
      labelDisplayedRows: ({ from, to, count }) =>
        `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`,
    },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height }}>
      {/* Toolbar externo con botón de exportación */}
      {showToolbar && (
        <Box sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          p: 1,
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-soft)',
          gap: 1,
        }}>
          <Tooltip title="Descargar XLSX">
            <IconButton
              onClick={handleExportXLSX}
              size="small"
              sx={{
                color: 'var(--success)',
                border: '1px solid var(--success)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-1) var(--space-2)',
                fontSize: '0.75rem',
                '&:hover': {
                  backgroundColor: 'var(--success)',
                  color: 'var(--on-primary)'
                }
              }}
            >
              <DownloadXlsxIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>XLSX</span>
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <Box sx={{ ...spmStyles, height: showToolbar ? 'calc(100% - 48px)' : '100%' }}>
        <DataGrid
          {...props}
          rows={rows}
          columns={columns}
          loading={loading}
          density={density}
          disableRowSelectionOnClick={disableRowSelectionOnClick}
          initialState={mergedInitialState}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={pageSizeOptions}
          getRowId={getRowId}
          localeText={localeText}
          disableColumnFilter={false}
          disableColumnSelector={false}
          disableDensitySelector={false}
        />
      </Box>
    </Box>
  );
}

export default SPMDataGrid;
