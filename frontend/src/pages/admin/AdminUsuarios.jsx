/**
 * AdminUsuarios - Administracion de usuarios del sistema
 * ✨ Migrado a SPMAgGrid para mejor rendimiento
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import InputAdornment from "@mui/material/InputAdornment";
import Divider from "@mui/material/Divider";
import FormHelperText from "@mui/material/FormHelperText";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import PeopleIcon from "@mui/icons-material/People";
import FilterListIcon from "@mui/icons-material/FilterList";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WarningIcon from "@mui/icons-material/Warning";
import InboxIcon from "@mui/icons-material/Inbox";
import CloseIcon from "@mui/icons-material/Close";

// ============================================================================
// CONSTANTES
// ============================================================================

const ROLES_OPTIONS = [
  { value: "solicitante", label: "Solicitante" },
  { value: "aprobador_solicitudes", label: "Aprobador Sol." },
  { value: "aprobador_presupuestos", label: "Aprobador Pres." },
  { value: "planificador", label: "Planificador" },
  { value: "administrador", label: "Administrador" },
];

const PUESTOS_OPTIONS = [
  { value: "Planificador", label: "Planificador" },
  { value: "Jefe", label: "Jefe" },
  { value: "Gerente1", label: "Gerente Nivel 1" },
  { value: "Gerente2", label: "Gerente Nivel 2" },
  { value: "Director", label: "Director" },
  { value: "Supervisor", label: "Supervisor" },
  { value: "Analista", label: "Analista" },
  { value: "Coordinador", label: "Coordinador" },
];

const SECTORES_OPTIONS = [
  { value: "1", label: "Almacenes" },
  { value: "2", label: "Compras" },
  { value: "3", label: "Mantenimiento" },
  { value: "4", label: "Planificacion" },
  { value: "5", label: "Operaciones" },
  { value: "6", label: "Logistica" },
  { value: "7", label: "Produccion" },
  { value: "8", label: "Calidad" },
];

const ESTADOS_OPTIONS = [
  { value: "Activo", label: "Activo" },
  { value: "Inactivo", label: "Inactivo" },
  { value: "Suspendido", label: "Suspendido" },
];

const initialForm = {
  id_spm: "",
  nombre: "",
  apellido: "",
  mail: "",
  mail_respaldo: "",
  telefono: "",
  posicion: "Analista",
  id_ypf: "",
  sector: "",
  roles: ["solicitante"],
  centros: "",
  almacenes: "",
  jefe: "",
  gerente1: "",
  gerente2: "",
  estado_registro: "Activo",
  contrasena: "spm123",
};

// ============================================================================
// UTILIDADES
// ============================================================================

function parseRoles(roles) {
  if (Array.isArray(roles)) return roles;
  if (typeof roles === "string") {
    try {
      const parsed = JSON.parse(roles);
      return Array.isArray(parsed) ? parsed : [roles];
    } catch {
      return roles ? [roles] : [];
    }
  }
  return [];
}

function getRoleColor(role) {
  const colors = {
    administrador: { bgcolor: "error.100", color: "error.800" },
    admin: { bgcolor: "error.100", color: "error.800" },
    aprobador_presupuestos: { bgcolor: "success.100", color: "success.800" },
    aprobador_solicitudes: { bgcolor: "warning.100", color: "warning.800" },
    planificador: { bgcolor: "secondary.100", color: "secondary.800" },
    solicitante: { bgcolor: "info.100", color: "info.800" },
  };
  return colors[role?.toLowerCase()] || { bgcolor: "grey.100", color: "grey.700" };
}

function getRoleAbbr(role) {
  const abbrs = {
    administrador: "Admin",
    admin: "Admin",
    aprobador_presupuestos: "Aprob. Pres.",
    aprobador_solicitudes: "Aprob. Sol.",
    planificador: "Planif.",
    solicitante: "Solicit.",
  };
  return abbrs[role?.toLowerCase()] || role;
}

// ============================================================================
// COMPONENTES UI
// ============================================================================

/** Badge de rol - estilo sutil */
function RoleBadge({ role }) {
  const colors = getRoleColor(role);
  return (
    <Chip
      label={getRoleAbbr(role)}
      size="small"
      sx={{
        height: 20,
        fontSize: "10px",
        fontWeight: 600,
        bgcolor: colors.bgcolor,
        color: colors.color,
        border: 1,
        borderColor: "grey.900",
        "& .MuiChip-label": {
          px: 1,
        },
      }}
    />
  );
}

/** Chips toggleables para roles */
function RoleChips({ value = [], onChange }) {
  const toggleRole = (roleValue) => {
    const newRoles = value.includes(roleValue)
      ? value.filter((r) => r !== roleValue)
      : [...value, roleValue];
    onChange(newRoles);
  };

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {ROLES_OPTIONS.map((role) => {
        const isActive = value.includes(role.value);
        return (
          <Chip
            key={role.value}
            label={role.label}
            onClick={() => toggleRole(role.value)}
            size="small"
            sx={{
              fontWeight: 600,
              fontSize: "12px",
              cursor: "pointer",
              bgcolor: isActive ? "primary.main" : "grey.50",
              color: isActive ? "common.white" : "text.secondary",
              border: 1,
              borderColor: isActive ? "primary.main" : "grey.200",
              "&:hover": {
                bgcolor: isActive ? "primary.dark" : "grey.100",
                borderColor: isActive ? "primary.dark" : "grey.300",
              },
            }}
          />
        );
      })}
    </Stack>
  );
}

/** Seccion del formulario */
function FormSection({ title, children }) {
  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <Typography
        variant="overline"
        sx={{
          fontSize: "11px",
          fontWeight: 600,
          color: "text.secondary",
          letterSpacing: 1,
          display: "block",
          mb: 2,
          pb: 1,
          borderBottom: 1,
          borderColor: "grey.100",
        }}
      >
        {title}
      </Typography>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}

/**
 * Tabla de usuarios migrada a SPMAgGrid
 */
function UsuariosTable({
  data,
  onEdit,
  onDelete,
  deletingId,
  onCancelDelete,
  onConfirmDelete,
  submitting,
}) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => ({ ...item, id: item.id_spm }));
  }, [data]);

  const columnDefs = useMemo(() => [
    {
      field: "id_spm",
      headerName: t('common_id', 'ID'),
      flex: 0.15,
      minWidth: 80,
      valueFormatter: (params) => params.value || "-",
    },
    {
      field: "nombre_apellido",
      headerName: t('common_nombre', 'Nombre'),
      flex: 0.35,
      minWidth: 150,
      valueFormatter: (params) =>
        `${params.data?.nombre || ""} ${params.data?.apellido || ""}`.trim() || "-",
    },
    {
      field: "roles",
      headerName: t('common_roles', 'Roles'),
      flex: 0.4,
      minWidth: 200,
      valueFormatter: (params) => {
        const roles = parseRoles(params.value || params.data?.rol);
        return roles.length > 0 ? roles.join(", ") : "-";
      },
      cellRenderer: (params) => {
        const roles = parseRoles(params.data?.roles || params.data?.rol);
        return (
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {roles.length > 0 ? (
              roles.map((rol, idx) => <RoleBadge key={idx} role={rol} />)
            ) : (
              <Typography color="text.disabled" variant="caption">
                -
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      field: "mail",
      headerName: t('common_email', 'Email'),
      flex: 0.35,
      minWidth: 150,
      valueFormatter: (params) => params.value || "-",
    },
    {
      field: "estado",
      headerName: t('common_estado', 'Estado'),
      flex: 0.2,
      minWidth: 100,
      cellRenderer: (params) => {
        const isActive =
          params.data?.estado_registro?.toLowerCase() === "activo";
        return (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: isActive ? "success.main" : "grey.400",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                color: isActive ? "success.700" : "text.disabled",
              }}
            >
              {isActive ? t('common_activo', 'Activo') : t('common_inactivo', 'Inactivo')}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: "acciones",
      headerName: t('common_acciones', 'Acciones'),
      flex: 0.15,
      minWidth: 80,
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <Button
          size="small"
          variant="text"
          onClick={() => onDelete && onDelete(params.data.id_spm)}
          disabled={!!deletingId}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            color: "error.main",
            fontSize: "0.75rem",
            minWidth: "auto",
            px: 1,
            "&:hover": { bgcolor: "error.lighter" },
          }}
        >
          {t('common_eliminar', 'Eliminar')}
        </Button>
      ),
    },
  ], [onDelete, deletingId, t]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Confirmación de eliminación */}
      {deletingId && (
        <Box
          sx={{
            p: 2,
            bgcolor: "error.50",
            borderLeft: 4,
            borderLeftColor: "error.400",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "error.800" }}>
            <WarningIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" fontWeight={500}>
              Eliminar a{" "}
              <Box component="strong">
                {data.find((u) => u.id_spm === deletingId)?.nombre}{" "}
                {data.find((u) => u.id_spm === deletingId)?.apellido}
              </Box>
              ?
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={onCancelDelete}
              disabled={submitting}
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "text.secondary",
                borderColor: "grey.200",
                "&:hover": { bgcolor: "grey.50" },
              }}
            >
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={() => onConfirmDelete && onConfirmDelete(deletingId)}
              disabled={submitting}
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {t('common_eliminar', 'Eliminar')}
            </Button>
          </Stack>
        </Box>
      )}

      {/* Tabla SPMAgGrid */}
      <SPMAgGrid
        rowData={rows}
        columnDefs={columnDefs}
        height={500}
        pagination={true}
        paginationPageSize={10}
        enableQuickFilter={true}
        exportFileName="usuarios"
        emptyMessage={t("common_no_data", "Sin usuarios")}
        onRowClick={(row) => onEdit && onEdit(row)}
        sx={{
          cursor: "pointer",
        }}
      />
    </Box>
  );
}

/** Fila con confirmacion de eliminacion inline */
function UserRow({ user, onEdit, onDelete, isDeleting, onCancelDelete, onConfirmDelete }) {
  const { t } = useI18n();
  const roles = parseRoles(user.roles || user.rol);
  const isActive = user.estado_registro?.toLowerCase() === "activo";

  if (isDeleting) {
    return (
      <TableRow
        sx={{
          bgcolor: "error.50",
          borderLeft: 4,
          borderLeftColor: "error.400",
        }}
      >
        <TableCell colSpan={6} sx={{ py: 1.5, px: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "error.800" }}>
              <WarningIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" fontWeight={500}>
                Eliminar a{" "}
                <Box component="strong">
                  {user.nombre} {user.apellido}
                </Box>
                ?
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={onCancelDelete}
                sx={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "text.secondary",
                  borderColor: "grey.200",
                  "&:hover": { bgcolor: "grey.50" },
                }}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={onConfirmDelete}
                sx={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                {t('common_eliminar', 'Eliminar')}
              </Button>
            </Stack>
          </Stack>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      onClick={onEdit}
      sx={{
        cursor: "pointer",
        "&:hover": { bgcolor: "grey.50" },
        "&:hover .delete-btn": { opacity: 1 },
        borderBottom: 1,
        borderColor: "grey.100",
      }}
    >
      <TableCell sx={{ px: 1.5, py: 1.5, borderRight: 1, borderColor: "grey.100" }}>
        <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.secondary", fontSize: "13px" }}>
          {user.id_spm}
        </Typography>
      </TableCell>
      <TableCell sx={{ px: 1.5, py: 1.5, borderRight: 1, borderColor: "grey.100" }}>
        <Typography
          variant="body2"
          fontWeight={500}
          noWrap
          sx={{ maxWidth: 160, fontSize: "13px" }}
        >
          {user.nombre} {user.apellido}
        </Typography>
      </TableCell>
      <TableCell sx={{ px: 1.5, py: 1.5, borderRight: 1, borderColor: "grey.100" }}>
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {roles.length > 0 ? (
            roles.map((rol, idx) => <RoleBadge key={idx} role={rol} />)
          ) : (
            <Typography color="text.disabled">-</Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell sx={{ px: 1.5, py: 1.5, borderRight: 1, borderColor: "grey.100" }}>
        <Typography variant="body2" noWrap title={user.mail} sx={{ color: "text.secondary", fontSize: "13px" }}>
          {user.mail || "-"}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ px: 1.5, py: 1.5, borderRight: 1, borderColor: "grey.100" }}>
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: isActive ? "success.main" : "grey.400",
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              color: isActive ? "success.700" : "text.disabled",
            }}
          >
            {isActive ? t('common_activo', 'Activo') : t('common_inactivo', 'Inactivo')}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell align="center" sx={{ px: 1, py: 1.5 }}>
        <IconButton
          className="delete-btn"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          sx={{
            opacity: 0,
            color: "grey.400",
            transition: "all 0.15s",
            "&:hover": { color: "error.main", bgcolor: "error.50" },
          }}
          aria-label={t("aria_delete_user", "Eliminar usuario")}
        >
          <DeleteIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

/** Estado vacio */
function EmptyState({ type = "no-data", onClearFilters }) {
  const { t } = useI18n();
  if (type === "no-results") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 8,
          textAlign: "center",
        }}
      >
        <SearchIcon sx={{ fontSize: 24, color: "grey.300", mb: 2 }} />
        <Typography variant="body2" fontWeight={600} color="text.primary" gutterBottom>
          {t('admin_no_results', 'No se encontraron usuarios')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Prueba ajustando los filtros de busqueda
        </Typography>
        <Button
          size="small"
          onClick={onClearFilters}
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            color: "primary.main",
            bgcolor: "primary.50",
            "&:hover": { bgcolor: "primary.100" },
          }}
        >
          Limpiar filtros
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        textAlign: "center",
      }}
    >
      <InboxIcon sx={{ fontSize: 48, color: "grey.300", mb: 2 }} />
      <Typography variant="body2" fontWeight={600} color="text.primary" gutterBottom>
        {t('admin_no_users', 'Sin usuarios')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('admin_no_users_desc', 'No hay usuarios registrados en el sistema')}
      </Typography>
    </Box>
  );
}

/** Skeleton de carga */
function LoadingSkeleton() {
  return (
    <Box>
      {[...Array(5)].map((_, i) => (
        <Stack
          key={i}
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "grey.100" }}
        >
          <Skeleton variant="rectangular" width={64} height={16} />
          <Skeleton variant="rectangular" width={128} height={16} />
          <Skeleton variant="rectangular" width={96} height={16} />
          <Skeleton variant="rectangular" width={160} height={16} />
          <Skeleton variant="rectangular" width={64} height={16} />
        </Stack>
      ))}
    </Box>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Estado principal
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filtros
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterRol, setFilterRol] = useState("");

  // Drawer y formulario
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Eliminacion inline
  const [deletingId, setDeletingId] = useState(null);

  // Cargar usuarios
  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("usuarios");
      const data = Array.isArray(res.data) ? res.data : [];
      setUsuarios(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  // Usuarios filtrados
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((user) => {
      // Busqueda
      if (search) {
        const searchLower = search.toLowerCase();
        const matchName = `${user.nombre} ${user.apellido}`.toLowerCase().includes(searchLower);
        const matchEmail = (user.mail || "").toLowerCase().includes(searchLower);
        const matchId = (user.id_spm || "").toLowerCase().includes(searchLower);
        if (!matchName && !matchEmail && !matchId) return false;
      }

      // Filtro estado
      if (filterEstado && user.estado_registro !== filterEstado) {
        return false;
      }

      // Filtro rol
      if (filterRol) {
        const roles = parseRoles(user.roles || user.rol);
        if (!roles.includes(filterRol)) return false;
      }

      return true;
    });
  }, [usuarios, search, filterEstado, filterRol]);

  // Opciones de jerarquia
  const jefesOptions = useMemo(
    () =>
      usuarios
        .filter((u) => u.posicion?.toLowerCase() === "jefe")
        .map((u) => ({
          value: u.id_spm,
          label: `${u.nombre} ${u.apellido}`,
        })),
    [usuarios]
  );

  const gerentes1Options = useMemo(
    () =>
      usuarios
        .filter((u) => u.posicion?.toLowerCase() === "gerente1")
        .map((u) => ({
          value: u.id_spm,
          label: `${u.nombre} ${u.apellido}`,
        })),
    [usuarios]
  );

  const gerentes2Options = useMemo(
    () =>
      usuarios
        .filter((u) => u.posicion?.toLowerCase() === "gerente2")
        .map((u) => ({
          value: u.id_spm,
          label: `${u.nombre} ${u.apellido}`,
        })),
    [usuarios]
  );

  // Handlers
  const handleNew = () => {
    setEditingUser(null);
    setForm(initialForm);
    setFormErrors({});
    setDrawerOpen(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    // Sanitizar nulls para evitar warnings de MUI TextField
    const sanitized = Object.fromEntries(
      Object.entries(user).map(([k, v]) => [k, v ?? ""])
    );
    setForm({
      ...initialForm,
      ...sanitized,
      roles: parseRoles(user.roles || user.rol),
      contrasena: "",
    });
    setFormErrors({});
    setDeletingId(null);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingUser(null);
    setForm(initialForm);
    setFormErrors({});
    setShowPassword(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Limpiar error del campo
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleRolesChange = (newRoles) => {
    setForm((prev) => ({ ...prev, roles: newRoles }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.id_spm) errors.id_spm = t('admin_required', 'Requerido');
    if (!form.nombre) errors.nombre = t('admin_required', 'Requerido');
    if (!form.apellido) errors.apellido = t('admin_required', 'Requerido');
    if (!form.mail) errors.mail = t('admin_required', 'Requerido');
    if (!editingUser && !form.contrasena) errors.contrasena = "Requerida para nuevos usuarios";
    if (form.roles.length === 0) errors.roles = t('admin_select_role', 'Selecciona al menos un rol');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...form,
        roles: JSON.stringify(form.roles),
      };

      if (editingUser) {
        await admin.update("usuarios", editingUser.id_spm, payload);
        setSuccess(t("crud_record_updated", "Usuario actualizado correctamente"));
      } else {
        await admin.create("usuarios", payload);
        setSuccess(t("crud_record_created", "Usuario creado correctamente"));
      }

      handleCloseDrawer();
      await loadUsuarios();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId) => {
    setSubmitting(true);
    try {
      await admin.remove("usuarios", userId);
      setSuccess(t("crud_record_deleted", "Usuario eliminado correctamente"));
      setDeletingId(null);
      await loadUsuarios();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterEstado("");
    setFilterRol("");
  };

  const hasActiveFilters = search || filterEstado || filterRol;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* HEADER */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "grey.200",
          boxShadow: 1,
        }}
      >
        <Box sx={{ maxWidth: 1600, mx: "auto", px: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 56 }}>
            {/* Left */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton
                onClick={() => navigate("/admin")}
                sx={{ ml: -1, color: "grey.400", "&:hover": { color: "grey.600", bgcolor: "grey.100" } }}
                aria-label={t("aria_back", "Volver")}
              >
                <ArrowBackIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "primary.main",
                    color: "common.white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PeopleIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: "text.primary", textTransform: "uppercase", letterSpacing: 0.5 }}
                  >
                    {t("admin_usuarios", "Usuarios")}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Right */}
            <Stack direction="row" spacing={1}>
              {/* Botón "Nuevo" */}
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleNew}
                sx={{
                  fontWeight: 600,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  px: 2,
                  height: 36,
                }}
              >
                {t('common_nuevo', 'Nuevo')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>

      {/* MAIN */}
      <Box component="main" sx={{ maxWidth: 1600, mx: "auto", px: 3, py: 3 }}>
        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* FILTROS */}
        <Paper elevation={0} sx={{ border: 1, borderColor: "grey.200", mb: 3 }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "grey.100", bgcolor: "grey.50" }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FilterListIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography
                variant="overline"
                sx={{ fontSize: "11px", fontWeight: 600, color: "text.secondary", letterSpacing: 1 }}
              >
                Filtros
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" flexWrap="wrap" alignItems="center" gap={2}>
              {/* Busqueda */}
              <TextField
                size="small"
                placeholder="Buscar por nombre, email o ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1, minWidth: 250, maxWidth: 400 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: "grey.400" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Filtro Estado */}
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Estado</InputLabel>
                <Select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  label="Estado"
                >
                  <MenuItem value="">Todos los estados</MenuItem>
                  {ESTADOS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Filtro Rol */}
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={filterRol}
                  onChange={(e) => setFilterRol(e.target.value)}
                  label="Rol"
                >
                  <MenuItem value="">Todos los roles</MenuItem>
                  {ROLES_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Contador */}
              <Chip
                icon={
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      bgcolor: "grey.400",
                      ml: 1,
                    }}
                  />
                }
                label={`${filteredUsuarios.length} usuarios`}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: "11px",
                  bgcolor: "grey.100",
                  color: "text.secondary",
                  "& .MuiChip-icon": { mr: 0.5 },
                }}
              />
            </Stack>
          </Box>
        </Paper>

        {/* TABLA */}
        <Paper elevation={0} sx={{ border: 1, borderColor: "grey.200" }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "grey.200", bgcolor: "grey.50" }}>
            <Typography
              variant="overline"
              sx={{ fontSize: "11px", fontWeight: 600, color: "text.primary", letterSpacing: 1 }}
            >
              Lista de Usuarios
            </Typography>
          </Box>

          {loading ? (
            <LoadingSkeleton />
          ) : filteredUsuarios.length === 0 ? (
            <EmptyState type={hasActiveFilters ? "no-results" : "no-data"} onClearFilters={clearFilters} />
          ) : (
            <UsuariosTable
              data={filteredUsuarios}
              onEdit={handleEdit}
              onDelete={(id) => setDeletingId(id)}
              deletingId={deletingId}
              onCancelDelete={() => setDeletingId(null)}
              onConfirmDelete={handleDelete}
              submitting={submitting}
            />
          )}

          {/* Footer */}
          {!loading && filteredUsuarios.length > 0 && (
            <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "grey.200", bgcolor: "grey.50" }}>
              <Typography variant="caption" color="text.secondary">
                Mostrando {filteredUsuarios.length} de {usuarios.length} usuarios
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* DRAWER */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 480 } },
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: "grey.200",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </Typography>
            {editingUser && (
              <Typography variant="caption" color="text.secondary">
                {editingUser.id_spm} - {editingUser.nombre} {editingUser.apellido}
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleCloseDrawer} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Drawer Content */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
          <Box component="form" id="user-form" onSubmit={handleSubmit}>
            {/* Datos Basicos */}
            <FormSection title="Datos Basicos">
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="ID SPM"
                  name="id_spm"
                  value={form.id_spm}
                  onChange={handleChange}
                  required
                  disabled={!!editingUser}
                  error={!!formErrors.id_spm}
                  helperText={formErrors.id_spm}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="ID YPF"
                  name="id_ypf"
                  value={form.id_ypf}
                  onChange={handleChange}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Nombre"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  required
                  error={!!formErrors.nombre}
                  helperText={formErrors.nombre}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Apellido"
                  name="apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  required
                  error={!!formErrors.apellido}
                  helperText={formErrors.apellido}
                />
              </Stack>
              <TextField
                fullWidth
                size="small"
                label="Email"
                name="mail"
                type="email"
                value={form.mail}
                onChange={handleChange}
                required
                error={!!formErrors.mail}
                helperText={formErrors.mail}
              />
              <TextField
                fullWidth
                size="small"
                label="Telefono"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
              />
            </FormSection>

            <Divider />

            {/* Puesto y Roles */}
            <FormSection title="Puesto y Roles">
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Puesto</InputLabel>
                  <Select
                    name="posicion"
                    value={form.posicion}
                    onChange={handleChange}
                    label="Puesto"
                  >
                    {PUESTOS_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Sector</InputLabel>
                  <Select
                    name="sector"
                    value={form.sector}
                    onChange={handleChange}
                    label="Sector"
                  >
                    <MenuItem value="">Seleccionar...</MenuItem>
                    {SECTORES_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mb: 1,
                    fontWeight: 500,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Roles <Box component="span" sx={{ color: "error.main" }}>*</Box>
                </Typography>
                <RoleChips value={form.roles} onChange={handleRolesChange} />
                {formErrors.roles && (
                  <FormHelperText error sx={{ mt: 0.5 }}>
                    {formErrors.roles}
                  </FormHelperText>
                )}
              </Box>
            </FormSection>

            <Divider />

            {/* Jerarquia */}
            <FormSection title="Jerarquia">
              <TextField
                fullWidth
                size="small"
                label="Centros"
                name="centros"
                value={form.centros}
                onChange={handleChange}
                placeholder="Ej: 1000, 2000, 3000"
              />
              <TextField
                fullWidth
                size="small"
                label="Almacenes"
                name="almacenes"
                value={form.almacenes}
                onChange={handleChange}
                placeholder="Ej: ALM01, ALM02"
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Jefe</InputLabel>
                  <Select
                    name="jefe"
                    value={form.jefe}
                    onChange={handleChange}
                    label="Jefe"
                  >
                    <MenuItem value="">-</MenuItem>
                    {jefesOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Gerente N1</InputLabel>
                  <Select
                    name="gerente1"
                    value={form.gerente1}
                    onChange={handleChange}
                    label="Gerente N1"
                  >
                    <MenuItem value="">-</MenuItem>
                    {gerentes1Options.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <FormControl fullWidth size="small">
                <InputLabel>Gerente N2</InputLabel>
                <Select
                  name="gerente2"
                  value={form.gerente2}
                  onChange={handleChange}
                  label="Gerente N2"
                >
                  <MenuItem value="">-</MenuItem>
                  {gerentes2Options.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </FormSection>

            <Divider />

            {/* Estado y Acceso */}
            <FormSection title="Estado y Acceso">
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  name="estado_registro"
                  value={form.estado_registro}
                  onChange={handleChange}
                  label="Estado"
                >
                  {ESTADOS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                size="small"
                label="Contrasena"
                name="contrasena"
                type={showPassword ? "text" : "password"}
                value={form.contrasena}
                onChange={handleChange}
                required={!editingUser}
                error={!!formErrors.contrasena}
                helperText={
                  formErrors.contrasena || (editingUser ? "Dejar vacio para no cambiar" : "")
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? (
                          <VisibilityOffIcon sx={{ fontSize: 18 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </FormSection>
          </Box>
        </Box>

        {/* Drawer Footer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: "grey.200",
            display: "flex",
            justifyContent: "flex-end",
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            onClick={handleCloseDrawer}
            disabled={submitting}
            sx={{
              fontWeight: 600,
              fontSize: "11px",
              textTransform: "uppercase",
            }}
          >
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            form="user-form"
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{
              fontWeight: 600,
              fontSize: "11px",
              textTransform: "uppercase",
            }}
          >
            {submitting ? t('common_guardando', 'Guardando...') : t('common_guardar', 'Guardar')}
          </Button>
        </Box>
      </Drawer>
      </Box>
    </Box>
  );
}
