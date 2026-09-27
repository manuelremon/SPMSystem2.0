/**
 * Piezas comunes del patrón CRUD de Administración (referencia: AdminCentros).
 * - NewButton: botón principal de alta (contained small + AddIcon, tipo oración).
 * - ActiveStatus: estado Activo/Inactivo con StatusBadge.
 * - RowActions: íconos Editar / Eliminar con Tooltip para la columna de acciones.
 * - actionsColumn: definición estándar de la columna de acciones de SPMAgGrid.
 */
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StatusBadge from "../ui/StatusBadge";
import { useI18n } from "../../context/i18n";

export function NewButton({ onClick, children, disabled, ...rest }) {
  const { t } = useI18n();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={<AddIcon />}
      onClick={onClick}
      disabled={disabled}
      sx={{ textTransform: "none" }}
      {...rest}
    >
      {children || t("crud_new", "Nuevo")}
    </Button>
  );
}

export function ActiveStatus({ activo }) {
  const isActivo = activo === 1 || activo === true || activo === "1";
  return <StatusBadge estado={isActivo ? "Activo" : "Inactivo"} disableTooltip />;
}

export function RowActions({ onEdit, onDelete, editLabel, deleteLabel, disabled, children }) {
  const { t } = useI18n();
  const editText = editLabel || t("common_editar", "Editar");
  const deleteText = deleteLabel || t("common_eliminar", "Eliminar");
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: "100%" }}>
      {children}
      {onEdit && (
        <Tooltip title={editText} describeChild>
          <span>
            <IconButton size="small" onClick={stop(onEdit)} aria-label={editText} disabled={disabled}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip title={deleteText} describeChild>
          <span>
            <IconButton size="small" color="error" onClick={stop(onDelete)} aria-label={deleteText} disabled={disabled}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Stack>
  );
}

/** Columna de acciones estándar para SPMAgGrid. */
export function actionsColumn(headerName, cellRenderer, extra = {}) {
  return {
    colId: "acciones",
    headerName,
    sortable: false,
    filter: false,
    resizable: false,
    flex: 0,
    width: 110,
    minWidth: 100,
    cellRenderer,
    ...extra,
  };
}
