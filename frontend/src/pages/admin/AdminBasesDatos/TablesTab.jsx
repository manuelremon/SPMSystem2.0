/**
 * TablesTab - Explorador de tablas de BD
 * ✨ Migrado a SPMAgGrid para consistencia visual y mejor rendimiento
 */

import { useMemo } from 'react';
import {
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Button,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DescriptionIcon from "@mui/icons-material/Description";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import { SPMAgGrid } from "../../../components/ui/SPMAgGrid";
import { useI18n } from "../../../context/i18n";

export function TablesTab({
  loading,
  databases,
  selectedDb,
  onDbChange,
  tables,
  onRefresh,
  onViewStructure,
  onViewData,
  onExportCsv,
}) {
  const { t } = useI18n();

  // Preparar datos para AG Grid
  const rows = useMemo(() => {
    return tables.map((table) => ({
      ...table,
      id: table.name, // AG Grid requiere 'id' único
    }));
  }, [tables]);

  // Definir columnas de AG Grid
  const columnDefs = useMemo(() => [
    {
      field: "name",
      headerName: t("common_name", "Tabla"),
      flex: 0.6,
      minWidth: 120,
      cellStyle: {
        fontFamily: "monospace",
        color: "var(--primary)",
      },
    },
    {
      field: "records",
      headerName: t("common_count", "Registros"),
      flex: 0.4,
      minWidth: 100,
      type: "numericColumn",
      valueFormatter: (params) => {
        if (params.value === null || params.value === undefined) return "0";
        return params.value.toLocaleString();
      },
      cellStyle: {
        fontFamily: "monospace",
        textAlign: "right",
      },
    },
    {
      field: "acciones",
      headerName: t("common_actions", "Acciones"),
      flex: 0.5,
      minWidth: 220,
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <Stack direction="row" spacing={0.5} justifyContent="center">
          <Button
            size="small"
            variant="text"
            startIcon={<DescriptionIcon />}
            onClick={() => onViewStructure(params.data.name)}
            sx={{ textTransform: "none", fontSize: "0.75rem" }}
          >
            {t("common_structure", "Estructura")}
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<SearchIcon />}
            onClick={() => onViewData(params.data.name)}
            sx={{ textTransform: "none", fontSize: "0.75rem" }}
          >
            {t("common_view", "Ver")}
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<DownloadIcon />}
            onClick={() => onExportCsv(params.data.name)}
            sx={{ textTransform: "none", fontSize: "0.75rem" }}
          >
            CSV
          </Button>
        </Stack>
      ),
    },
  ], [t, onViewStructure, onViewData, onExportCsv]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="db-select-label">
            {t("admin_db_select", "Base de datos")}
          </InputLabel>
          <Select
            labelId="db-select-label"
            value={selectedDb}
            label={t("admin_db_select", "Base de datos")}
            onChange={(e) => onDbChange(e.target.value)}
          >
            {databases.map((db) => (
              <MenuItem key={db.name} value={db.name}>
                {db.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton
          onClick={onRefresh}
          disabled={loading}
          color="primary"
          title={t("common_refresh", "Actualizar")}
        >
          <RefreshIcon
            sx={{
              animation: loading ? "spin 1s linear infinite" : "none",
              "@keyframes spin": {
                "0%": { transform: "rotate(0deg)" },
                "100%": { transform: "rotate(360deg)" },
              },
            }}
          />
        </IconButton>
      </Stack>

      <SPMAgGrid
        rowData={rows}
        columnDefs={columnDefs}
        loading={loading}
        height={500}
        paginationPageSize={25}
        enableQuickFilter={true}
        exportFileName="tablas_bd"
        emptyMessage={t("common_no_data", "Sin datos")}
      />
    </Box>
  );
}
