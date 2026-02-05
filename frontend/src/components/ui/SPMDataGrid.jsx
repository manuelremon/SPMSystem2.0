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
      border: '1px solid #dce0e6',
      borderRadius: 'var(--radius-md)',
      backgroundColor: '#ffffff',
    },
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: '#ffffff !important',
      color: '#1f1f20 !important',
      borderBottom: '2px solid #dce0e6',
    },
    '& .MuiDataGrid-columnHeader': {
      backgroundColor: '#ffffff !important',
      color: '#1f1f20 !important',
      borderRight: '1px solid #dce0e6 !important',
      '&:last-of-type': {
        borderRight: 'none !important',
      },
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 600,
      color: '#1f1f20 !important',
      fontSize: '0.875rem',
      padding: '0 4px',
    },
    '& .MuiDataGrid-sortIcon': {
      color: '#606d80 !important',
      fill: '#606d80 !important',
      opacity: '1 !important',
    },
    '& .MuiDataGrid-sortIcon path': {
      fill: '#606d80 !important',
    },
    '& .MuiDataGrid-menuIconButton': {
      color: '#606d80 !important',
    },
    '& .MuiDataGrid-iconButtonContainer': {
      visibility: 'visible !important',
    },
    '& .MuiDataGrid-columnHeader svg': {
      color: '#606d80 !important',
      fill: '#606d80 !important',
    },
    '& .MuiDataGrid-columnHeader svg path': {
      fill: '#606d80 !important',
    },
    '& .MuiDataGrid-cell': {
      borderBottom: '1px solid #dce0e6 !important',  // Color5
      borderRight: '1px solid #dce0e6 !important',
      color: '#1f1f20',                              // Color1
      fontSize: '0.875rem',
      padding: '0 12px',
      '&:last-of-type': {
        borderRight: 'none !important',
      },
    },
    '& .MuiDataGrid-row': {
      '& .MuiDataGrid-cell': {
        borderRight: '1px solid #dce0e6 !important',
        '&:last-of-type': {
          borderRight: 'none !important',
        },
      },
    },
    '& .MuiDataGrid-row:hover': {
      backgroundColor: '#f0f2f5',        // Gris muy claro
    },
    '& .MuiDataGrid-row.Mui-selected': {
      backgroundColor: '#e8eef5',        // Azul muy claro
      '&:hover': {
        backgroundColor: '#e8eef5',
      },
    },
    '& .MuiDataGrid-footerContainer': {
      borderTop: '1px solid #dce0e6',
      backgroundColor: '#f5f7fa',        // Fondo principal
    },
    '& .MuiDataGrid-toolbarContainer': {
      padding: '8px 16px',
      gap: '8px',
      borderBottom: '1px solid #dce0e6',
    },
    '& .MuiButton-root': {
      textTransform: 'none',
      fontSize: '0.875rem',
    },
    '& .MuiDataGrid-overlay': {
      backgroundColor: '#ffffff',
    },
    '& .MuiTablePagination-root': {
      color: '#1f1f20',
    },
    '& .MuiDataGrid-columnSeparator': {
      display: 'none',
    },
    // Asegurar bordes visibles en todas las celdas
    '& .MuiDataGrid-virtualScroller': {
      '& .MuiDataGrid-cell': {
        borderRight: '1px solid #dce0e6 !important',
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
      borderBottom: '1px solid #dce0e6',
      backgroundColor: '#f8f9fa',
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
            color: '#567ebb',
            border: '1px solid #567ebb',
            borderRadius: '8px',
            padding: '6px',
            '&:hover': {
              backgroundColor: '#567ebb',
              color: '#fff'
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
          borderBottom: '1px solid #dce0e6',
          backgroundColor: '#f8f9fa',
          gap: 1,
        }}>
          <Tooltip title="Descargar XLSX">
            <IconButton
              onClick={handleExportXLSX}
              size="small"
              sx={{
                color: '#388e3c',
                border: '1px solid #388e3c',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                '&:hover': {
                  backgroundColor: '#388e3c',
                  color: '#fff'
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
