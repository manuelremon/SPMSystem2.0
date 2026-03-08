/**
 * DatabaseModals - Modales para administracion de BD
 * Estructura, Preview/CRUD, Stats, Audit, Connections
 * Migrado a Material UI
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShieldIcon from "@mui/icons-material/Shield";
import { getInputType } from "./useAdminDatabase";
import { useI18n } from '../../../context/i18n';

// Modal de Estructura de Tabla
export function StructureModal({ isOpen, onClose, tableStructure }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
        {t('admin_estructura', 'Estructura') + ':'} {tableStructure?.table}
      </DialogTitle>
      <DialogContent dividers>
        {tableStructure && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", mb: 1 }}>
                {t('admin_columnas', 'Columnas')}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell align="center">PK</TableCell>
                      <TableCell align="center">Nullable</TableCell>
                      <TableCell>Default</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableStructure.columns.map((col, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontFamily: "monospace", color: "primary.main" }}>{col.name}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{col.type}</TableCell>
                        <TableCell align="center">
                          {col.pk ? <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} /> : "-"}
                        </TableCell>
                        <TableCell align="center">{col.nullable ? "Si" : "No"}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{col.default || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {tableStructure.indexes?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", mb: 1 }}>
                  {t('admin_indices', 'Índices')}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {tableStructure.indexes.map((idx, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                      <Typography sx={{ fontFamily: "monospace", fontSize: "0.875rem", color: "primary.main" }}>
                        {idx.name}
                      </Typography>
                      {idx.columns && (
                        <Typography variant="caption" color="text.secondary">
                          Columnas: {idx.columns.join(", ")}
                        </Typography>
                      )}
                      {idx.unique && (
                        <Chip label="UNIQUE" color="info" size="small" sx={{ mt: 0.5 }} />
                      )}
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          {t('common_cerrar', 'Cerrar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Modal de Preview con CRUD
export function PreviewModal({
  isOpen,
  onClose,
  tablePreview,
  isReadOnly,
  onAdd,
  onEdit,
  onDelete,
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
    >
      <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
        Datos: {tablePreview?.table}
      </DialogTitle>
      <DialogContent dividers>
        {tablePreview && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Boton agregar */}
            {!isReadOnly && (
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  onClick={onAdd}
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                >
                  {t('admin_agregar_registro', 'Agregar registro')}
                </Button>
              </Box>
            )}

            {isReadOnly && (
              <Alert severity="warning" icon={<ShieldIcon />}>
                {t('admin_solo_lectura', 'Esta tabla es de solo lectura')}
              </Alert>
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "60vh" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {!isReadOnly && (
                      <TableCell align="center" sx={{ fontWeight: 600, color: "text.secondary", width: 80, bgcolor: "background.paper" }}>
                        Acciones
                      </TableCell>
                    )}
                    {tablePreview.columns.map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap", bgcolor: "background.paper" }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tablePreview.rows.map((row, i) => (
                    <TableRow key={i} hover>
                      {!isReadOnly && (
                        <TableCell align="center">
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => onEdit(row)}
                              title="Editar"
                            >
                              <EditIcon fontSize="small" color="info" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => onDelete(row)}
                              title="Eliminar"
                            >
                              <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      )}
                      {tablePreview.columns.map((col) => (
                        <TableCell
                          key={col}
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                            whiteSpace: "nowrap",
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {row[col] ?? <Typography component="span" color="text.secondary">NULL</Typography>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" align="center">
              Mostrando {tablePreview.rows.length} de {tablePreview.total.toLocaleString()} registros
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          {t('common_cerrar', 'Cerrar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Modal de Agregar/Editar Registro
export function CrudFormModal({
  isOpen,
  onClose,
  title,
  tableColumns,
  tablePk,
  formData,
  editRow,
  loading,
  onFormChange,
  onSubmit,
  isEdit = false,
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
        {title}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {/* Mostrar PK (solo lectura) para edicion */}
          {isEdit && tablePk.map((pkCol) => (
            <Box key={pkCol}>
              <TextField
                label={`${pkCol} ${t('admin_pk_readonly', '(PK - Solo lectura)')}`}
                value={editRow?.[pkCol] || ""}
                disabled
                fullWidth
                size="small"
                sx={{ bgcolor: "action.hover" }}
              />
            </Box>
          ))}

          {tableColumns.filter(col => col.editable && !col.is_pk).map((col) => (
            <Box key={col.name}>
              {getInputType(col.type) === "checkbox" ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData[col.name] === "1" || formData[col.name] === true || formData[col.name] === "true"}
                      onChange={(e) => onFormChange(col.name, e.target.checked ? "1" : "0")}
                    />
                  }
                  label={
                    <Box component="span">
                      {col.name}
                      {!col.nullable && <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>}
                    </Box>
                  }
                />
              ) : (
                <TextField
                  label={
                    <Box component="span">
                      {col.name}
                      {!col.nullable && <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>}
                    </Box>
                  }
                  type={getInputType(col.type)}
                  value={formData[col.name] || ""}
                  onChange={(e) => onFormChange(col.name, e.target.value)}
                  placeholder={col.type}
                  fullWidth
                  size="small"
                  helperText={!isEdit ? `Tipo: ${col.type}${col.default ? ` | Default: ${col.default}` : ""}` : undefined}
                />
              )}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onClose}
          disabled={loading}
          sx={{ textTransform: "uppercase" }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={loading}
          startIcon={loading ? <RefreshIcon sx={{ animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} /> : isEdit ? <EditIcon /> : <AddIcon />}
          sx={{ textTransform: "uppercase" }}
        >
          {isEdit ? t('common_guardar', 'Guardar cambios') : t('admin_crear_registro', 'Crear registro')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Modal de Eliminar Registro
export function DeleteModal({
  isOpen,
  onClose,
  row,
  loading,
  onDelete,
  onSoftDelete,
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700, color: "error.main" }}>
        {t('admin_confirm_delete', 'Confirmar eliminación')}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Alert severity="error" icon={<WarningIcon />}>
            {t('admin_delete_warning', 'Esta acción no se puede deshacer. El registro será eliminado permanentemente.')}
          </Alert>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Datos del registro:
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {row && Object.entries(row).slice(0, 8).map(([key, val]) => (
                <Box key={key} sx={{ display: "flex", fontFamily: "monospace", fontSize: "0.75rem" }}>
                  <Typography component="span" color="text.secondary" sx={{ width: 96, flexShrink: 0, fontFamily: "inherit", fontSize: "inherit" }}>
                    {key}:
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: "inherit",
                      fontSize: "inherit",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 200,
                    }}
                  >
                    {val ?? "NULL"}
                  </Typography>
                </Box>
              ))}
              {row && Object.keys(row).length > 8 && (
                <Typography variant="caption" color="text.secondary">
                  ... y {Object.keys(row).length - 8} campos mas
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onClose}
          disabled={loading}
          sx={{ textTransform: "uppercase" }}
        >
          Cancelar
        </Button>
        <Button
          variant="outlined"
          color="warning"
          onClick={onSoftDelete}
          disabled={loading}
          startIcon={loading ? <RefreshIcon sx={{ animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} /> : <CancelIcon />}
          sx={{ textTransform: "uppercase" }}
        >
          {t('admin_soft_delete', 'Soft Delete')}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onDelete}
          disabled={loading}
          startIcon={loading ? <RefreshIcon sx={{ animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} /> : <DeleteIcon />}
          sx={{ textTransform: "uppercase" }}
        >
          {t('common_eliminar', 'Eliminar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Modal de Estadisticas de Tabla
export function StatsModal({ isOpen, onClose, tableName, tableStats }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
        Estadisticas: {tableName}
      </DialogTitle>
      <DialogContent dividers>
        {tableStats && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">Filas</Typography>
                <Typography variant="h5" fontWeight={700}>{tableStats.stats.actual_rows?.toLocaleString()}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">Tamaño</Typography>
                <Typography variant="h5" fontWeight={700}>{tableStats.stats.total_size_mb} MB</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">Indices</Typography>
                <Typography variant="h5" fontWeight={700}>{tableStats.stats.index_count}</Typography>
              </Paper>
              {tableStats.type === "postgresql" && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Fragmentacion</Typography>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ color: tableStats.stats.fragmentation_pct > 20 ? "warning.main" : "success.main" }}
                  >
                    {tableStats.stats.fragmentation_pct}%
                  </Typography>
                </Paper>
              )}
            </Box>

            {tableStats.type === "postgresql" && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Ultimo Mantenimiento
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Typography variant="body2">
                    <Typography component="span" color="text.secondary">VACUUM:</Typography> {tableStats.stats.last_vacuum || tableStats.stats.last_autovacuum || "Nunca"}
                  </Typography>
                  <Typography variant="body2">
                    <Typography component="span" color="text.secondary">ANALYZE:</Typography> {tableStats.stats.last_analyze || tableStats.stats.last_autoanalyze || "Nunca"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
                  <Typography variant="body2">
                    <Typography component="span" color="text.secondary">Live tuples:</Typography> {tableStats.stats.live_tuples?.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    <Typography component="span" color="text.secondary">Dead tuples:</Typography> {tableStats.stats.dead_tuples?.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            )}

            {tableStats.type === "sqlite" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Typography variant="body2">
                  <Typography component="span" color="text.secondary">Paginas:</Typography> {tableStats.stats.page_count?.toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <Typography component="span" color="text.secondary">Tamaño pagina:</Typography> {tableStats.stats.page_size} bytes
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          {t('common_cerrar', 'Cerrar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Modal de Audit Logs
export function AuditModal({ isOpen, onClose, auditLogs }) {
  const { t } = useI18n();
  const getChipColor = (action) => {
    if (action.includes("DELETE")) return "error";
    if (action.includes("CREATE")) return "success";
    if (action.includes("UPDATE")) return "warning";
    return "default";
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
    >
      <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
        Audit Log - Ultimos 7 dias
      </DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ maxHeight: "60vh" }}>
          {auditLogs.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 8 }}>
              No hay registros de auditoria
            </Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Fecha</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Accion</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Entidad</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Usuario</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.action}
                        color={getChipColor(log.action)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{log.entity_type}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{log.user_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          {t('common_cerrar', 'Cerrar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Modal de Conexiones Activas
export function ConnectionsModal({ isOpen, onClose, connections }) {
  const { t } = useI18n();
  const getChipColor = (state) => {
    if (state === "active") return "success";
    if (state === "idle") return "default";
    return "warning";
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
    >
      <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
        Conexiones Activas - PostgreSQL
      </DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ maxHeight: "60vh" }}>
          {connections.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 8 }}>
              No hay conexiones activas
            </Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: "background.paper" }}>PID</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Usuario</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>App</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Estado</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Duracion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {connections.map((conn) => (
                  <TableRow key={conn.pid} hover>
                    <TableCell sx={{ fontFamily: "monospace" }}>{conn.pid}</TableCell>
                    <TableCell>{conn.user}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{conn.application || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        label={conn.state}
                        color={getChipColor(conn.state)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>
                      {conn.query_duration_sec ? `${conn.query_duration_sec}s` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          {t('common_cerrar', 'Cerrar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
