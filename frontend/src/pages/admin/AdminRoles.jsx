import { useEffect, useState, useCallback } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { useNavigate } from "react-router-dom";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Drawer,
  Chip,
  FormControlLabel,
  Checkbox,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";

// Services
import { exportToXLSX } from "../../services/export";

const ROLES_OPTIONS = [
  { value: "solicitante", label: "Solicitante" },
  { value: "aprobador_solicitudes", label: "Aprobador de Solicitudes" },
  { value: "aprobador_presupuestos", label: "Aprobador de Presupuestos" },
  { value: "planificador", label: "Planificador" },
  { value: "administrador", label: "Administrador" },
];

const initialForm = {
  nombre: "",
  activo: 1,
};

/* ─────────────────────────────────────────────────────────────
   Skeleton Component
───────────────────────────────────────────────────────────── */
function TableSkeleton({ rows = 5 }) {
  return (
    <Box>
      {[...Array(rows)].map((_, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            borderBottom: 1,
            borderColor: "divider",
            py: 1.5,
            px: 2,
            gap: 2,
          }}
        >
          <Skeleton variant="text" width={64} height={24} />
          <Skeleton variant="text" sx={{ flex: 1 }} height={24} />
          <Skeleton variant="text" width={80} height={24} />
          <Skeleton variant="text" width={128} height={24} />
          <Skeleton variant="text" width={48} height={24} />
        </Box>
      ))}
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Empty State Component
───────────────────────────────────────────────────────────── */
function EmptyState({ message, onAction, actionLabel }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        color: "text.disabled",
      }}
    >
      <DescriptionIcon sx={{ fontSize: 48, mb: 1.5, opacity: 0.5 }} />
      <Typography variant="body2" sx={{ mb: 2 }}>
        {message}
      </Typography>
      {onAction && (
        <Button
          onClick={onAction}
          size="small"
          sx={{
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontSize: "0.75rem",
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function AdminRoles() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [exporting, setExporting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ─── Load Data ────────────────────────────────────────────
  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("roles");
      const data = Array.isArray(res.data) ? res.data : [];
      setRoles(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // ─── Filtered Data ────────────────────────────────────────
  const filteredRoles = roles.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return r.nombre?.toLowerCase().includes(term);
  });

  // ─── Handlers ─────────────────────────────────────────────
  const handleNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
  };

  const handleEdit = (row) => {
    setEditingId(row.nombre);
    setForm({
      nombre: row.nombre || "",
      activo: row.activo ?? 1,
    });
    setDrawerOpen(true);
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.nombre) {
      setError(t("admin_required_fields", "Faltan campos obligatorios"));
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await admin.update("roles", editingId, form);
        setSuccess(t("crud_record_updated", "Rol actualizado correctamente"));
      } else {
        await admin.create("roles", form);
        setSuccess(t("crud_record_created", "Rol creado correctamente"));
      }
      setDrawerOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadRoles();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (nombre) => {
    setSubmitting(true);
    try {
      await admin.remove("roles", nombre);
      setSuccess(t("crud_record_deleted", "Rol eliminado correctamente"));
      setDeletingId(null);
      await loadRoles();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleLabel = (value) => {
    const opt = ROLES_OPTIONS.find((o) => o.value === value);
    return opt ? opt.label : value;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(
        filteredRoles,
        "roles",
        "Roles"
      );
      setSuccess("Roles exportados correctamente");
    } catch (err) {
      setError(err.message || "Error al exportar roles");
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1152, mx: "auto", px: 2, py: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <IconButton
              onClick={() => navigate("/admin")}
              size="small"
              sx={{
                color: "text.secondary",
                "&:hover": {
                  color: "text.primary",
                  bgcolor: "grey.200",
                },
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "text.primary",
              }}
            >
              {t("admin_roles", "Roles")}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Tooltip title="Descargar XLSX">
              <span>
                <IconButton
                  onClick={handleExport}
                  disabled={loading || exporting || filteredRoles.length === 0}
                  size="small"
                  sx={{
                    color: "var(--success)",
                    border: "1px solid var(--success)",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    "&:hover": {
                      backgroundColor: "var(--success)",
                      color: "var(--card)",
                    },
                    "&:disabled": {
                      opacity: 0.5,
                      cursor: "not-allowed",
                    },
                  }}
                >
                  {exporting ? (
                    <CircularProgress size={14} sx={{ color: "var(--success)" }} />
                  ) : (
                    <>
                      <FileDownloadIcon sx={{ fontSize: "1rem", mr: 0.5 }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>XLSX</span>
                    </>
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              onClick={handleNew}
              size="small"
              sx={{
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.75rem",
                fontWeight: 500,
              }}
            >
              {t("crud_new", "Nuevo")}
            </Button>
          </Box>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setSuccess("")}
          >
            {success}
          </Alert>
        )}

        {/* Search */}
        <Box sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            sx={{ width: 320 }}
          />
        </Box>

        {/* Table */}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : filteredRoles.length === 0 ? (
            <EmptyState
              message={
                searchTerm
                  ? "No se encontraron roles"
                  : "No hay roles registrados"
              }
              onAction={!searchTerm ? handleNew : undefined}
              actionLabel="Crear primer rol"
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "grey.50" }}>
                  <TableCell
                    sx={{
                      width: 70,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.05em",
                      color: "text.secondary",
                      borderRight: 1,
                      borderColor: "divider",
                    }}
                  >
                    #
                  </TableCell>
                  <TableCell
                    sx={{
                      width: 200,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.05em",
                      color: "text.secondary",
                      borderRight: 1,
                      borderColor: "divider",
                    }}
                  >
                    Codigo
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.05em",
                      color: "text.secondary",
                      borderRight: 1,
                      borderColor: "divider",
                    }}
                  >
                    Descripcion
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      width: 90,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.05em",
                      color: "text.secondary",
                      borderRight: 1,
                      borderColor: "divider",
                    }}
                  >
                    Estado
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      width: 100,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.05em",
                      color: "text.secondary",
                    }}
                  >
                    Acciones
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoles.map((row, idx) =>
                  deletingId === row.nombre ? (
                    <TableRow
                      key={row.nombre}
                      sx={{ bgcolor: "error.lighter" }}
                    >
                      <TableCell colSpan={5}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography variant="body2" color="error.dark">
                            Eliminar{" "}
                            <Box component="strong" sx={{ fontWeight: 600 }}>
                              {getRoleLabel(row.nombre)}
                            </Box>
                            ?
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setDeletingId(null)}
                              disabled={submitting}
                              sx={{
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                fontSize: "0.75rem",
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={() => handleDelete(row.nombre)}
                              disabled={submitting}
                              sx={{
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                fontSize: "0.75rem",
                              }}
                            >
                              {submitting ? "..." : "Eliminar"}
                            </Button>
                          </Stack>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={row.nombre}
                      hover
                      sx={{
                        "&:hover": { bgcolor: "grey.50" },
                      }}
                    >
                      <TableCell
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "grey.100",
                        }}
                      >
                        {idx + 1}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontSize: "0.875rem",
                          fontFamily: "monospace",
                          color: "text.primary",
                          borderRight: 1,
                          borderColor: "grey.100",
                        }}
                      >
                        {row.nombre}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontSize: "0.875rem",
                          color: "text.primary",
                          borderRight: 1,
                          borderColor: "grey.100",
                        }}
                      >
                        {getRoleLabel(row.nombre)}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          borderRight: 1,
                          borderColor: "grey.100",
                        }}
                      >
                        <Chip
                          label={
                            row.activo === 1 || row.activo === true
                              ? "Activo"
                              : "Inactivo"
                          }
                          size="small"
                          color={
                            row.activo === 1 || row.activo === true
                              ? "success"
                              : "default"
                          }
                          sx={{
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            height: 20,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="center"
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(row)}
                            title="Editar"
                            sx={{
                              color: "text.secondary",
                              "&:hover": {
                                color: "primary.main",
                                bgcolor: "primary.lighter",
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setDeletingId(row.nombre)}
                            title="Eliminar"
                            sx={{
                              color: "text.secondary",
                              "&:hover": {
                                color: "error.main",
                                bgcolor: "error.lighter",
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </Paper>

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 2, color: "text.disabled" }}
        >
          {filteredRoles.length} de {roles.length} roles
        </Typography>
      </Box>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: "100%",
            maxWidth: 448,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "grey.50",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "text.primary",
            }}
          >
            {editingId ? "Editar Rol" : "Nuevo Rol"}
          </Typography>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            flex: 1,
            overflow: "auto",
            p: 2.5,
          }}
        >
          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {error}
              </Alert>
            )}

            <FormControl size="small" fullWidth required disabled={!!editingId}>
              <InputLabel
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Rol
              </InputLabel>
              <Select
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                label="Rol"
              >
                <MenuItem value="">
                  <em>Seleccionar...</em>
                </MenuItem>
                {ROLES_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.activo === 1 || form.activo === true}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      activo: e.target.checked ? 1 : 0,
                    }))
                  }
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.primary">
                  Activo
                </Typography>
              }
            />

            <Box
              sx={{
                display: "flex",
                gap: 1,
                pt: 2,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Button
                variant="outlined"
                onClick={() => setDrawerOpen(false)}
                disabled={submitting}
                fullWidth
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "0.75rem",
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                fullWidth
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "0.75rem",
                }}
              >
                {submitting
                  ? "Guardando..."
                  : editingId
                  ? "Actualizar"
                  : "Crear"}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
