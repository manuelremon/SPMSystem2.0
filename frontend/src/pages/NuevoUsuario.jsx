/**
 * NuevoUsuario - New User Profile Configuration
 * SAP/Enterprise UI - Migrated to MUI components
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as account from "../services/account";
import { useI18n } from "../context/i18n";

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
import CircularProgress from "@mui/material/CircularProgress";

// MUI Icons
import PersonIcon from "@mui/icons-material/Person";
import ShieldIcon from "@mui/icons-material/Shield";
import BusinessIcon from "@mui/icons-material/Business";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import CheckIcon from "@mui/icons-material/Check";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";

// ============================================================================
// COMPONENTES UI
// ============================================================================

/** Seccion del formulario */
function FormSection({ title, children }) {
  return (
    <Box sx={{ px: 3, py: 2.5 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          mb: 2,
          pb: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {title}
      </Typography>
      <Stack spacing={2}>
        {children}
      </Stack>
    </Box>
  );
}

/** Select de formulario */
function FormSelect({ label, value, onChange, options = [], placeholder = "Seleccionar..." }) {
  return (
    <FormControl fullWidth size="small">
      {label && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 500,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            mb: 0.5,
          }}
        >
          {label}
        </Typography>
      )}
      <Select
        value={value}
        onChange={onChange}
        displayEmpty
        sx={{
          "& .MuiSelect-select": {
            fontSize: "0.875rem",
            fontWeight: 500,
          },
        }}
      >
        <MenuItem value="" disabled>
          {placeholder}
        </MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt.value || opt.id} value={opt.value || opt.id}>
            {opt.label || opt.nombre}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/** Textarea de formulario */
function FormTextarea({ label, value, onChange, placeholder = "", rows = 3, helper = "" }) {
  return (
    <Box>
      {label && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 500,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            mb: 0.5,
          }}
        >
          {label}
        </Typography>
      )}
      <TextField
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        multiline
        rows={rows}
        fullWidth
        size="small"
        sx={{
          "& .MuiInputBase-input": {
            fontSize: "0.875rem",
          },
        }}
      />
      {helper && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
}

/** Chips toggleables para multi-seleccion */
function MultiSelectChips({ options = [], value = [], onChange, emptyText = "Sin opciones disponibles" }) {
  const toggleItem = (itemValue) => {
    const newValue = value.includes(itemValue)
      ? value.filter(v => v !== itemValue)
      : [...value, itemValue];
    onChange(newValue);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        minHeight: 80,
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        alignContent: "flex-start",
      }}
    >
      {options.length > 0 ? (
        options.map((opt) => {
          const optValue = opt.value || opt.id;
          const optLabel = opt.label || opt.nombre;
          const isActive = value.includes(optValue);
          return (
            <Chip
              key={optValue}
              label={optLabel}
              onClick={() => toggleItem(optValue)}
              color={isActive ? "primary" : "default"}
              variant={isActive ? "filled" : "outlined"}
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            />
          );
        })
      ) : (
        <Typography variant="body2" color="text.disabled">
          {emptyText}
        </Typography>
      )}
    </Paper>
  );
}

/** Skeleton de carga */
function LoadingSkeleton() {
  return (
    <Stack spacing={3}>
      <Paper variant="outlined">
        <Box sx={{ px: 3, py: 2.5 }}>
          <Skeleton variant="text" width={128} height={16} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={40} />
        </Box>
      </Paper>
      <Paper variant="outlined">
        <Box sx={{ px: 3, py: 2.5 }}>
          <Skeleton variant="text" width={160} height={16} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={80} />
        </Box>
      </Paper>
    </Stack>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function NuevoUsuario() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [catalogos, setCatalogos] = useState({ roles: [], sectores: [], centros: [], almacenes: [] });
  const [form, setForm] = useState({
    rol_solicitado: "",
    sector_nuevo: "",
    centros_nuevos: [],
    almacenes_nuevos: [],
    justificacion: ""
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const [roles, sectores, centros, almacenes] = await Promise.all([
        account.catalogs.roles().catch(() => ({ data: [] })),
        account.catalogs.sectores(),
        account.catalogs.centros(),
        account.catalogs.almacenes(),
      ]);
      setCatalogos({
        roles: roles.data || [],
        sectores: sectores.data || [],
        centros: centros.data || [],
        almacenes: almacenes.data || [],
      });
    } catch (err) {
      setError(t("nuevo_usuario_error_catalogos", "Error al cargar catalogos"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const hasChanges = form.rol_solicitado || form.sector_nuevo ||
                       form.centros_nuevos.length > 0 || form.almacenes_nuevos.length > 0;

    if (!hasChanges) {
      setError(t("nuevo_usuario_error_vacio", "Debes solicitar al menos un permiso"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await account.requestProfileChange(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || t("nuevo_usuario_error_envio", "Error al enviar solicitud"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate("/dashboard");
  };

  // ============================================================================
  // RENDER - Estado de exito
  // ============================================================================

  if (submitted) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
        {/* Header */}
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            bgcolor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            boxShadow: 1,
          }}
        >
          <Box sx={{ maxWidth: 1200, mx: "auto", px: 3 }}>
            <Stack direction="row" alignItems="center" sx={{ height: 56 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PersonIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    color: "text.primary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {t("nuevo_usuario_title", "Bienvenido a SPM")}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Box>

        {/* Main */}
        <Box component="main" sx={{ maxWidth: 600, mx: "auto", px: 3, py: 6 }}>
          <Paper variant="outlined" sx={{ boxShadow: 1 }}>
            <Box sx={{ py: 6, px: 3, textAlign: "center" }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  mx: "auto",
                  mb: 3,
                  bgcolor: "success.lighter",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckIcon sx={{ fontSize: 24, color: "success.main" }} />
              </Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: "text.primary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 1.5,
                }}
              >
                {t("nuevo_usuario_success_title", "Solicitud Enviada")}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 4, maxWidth: 400, mx: "auto" }}
              >
                {t("nuevo_usuario_success_desc", "Tu solicitud de permisos ha sido enviada. Un administrador la revisara y te notificara cuando sea procesada.")}
              </Typography>
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate("/dashboard")}
                sx={{
                  px: 3,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {t("nuevo_usuario_continuar", "Continuar al Dashboard")}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>
    );
  }

  // ============================================================================
  // RENDER - Formulario principal
  // ============================================================================

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      {/* Header */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          boxShadow: 1,
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: "auto", px: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ height: 56 }}
          >
            {/* Left */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton
                onClick={handleSkip}
                sx={{ ml: -1, color: "text.secondary" }}
                aria-label="Ir al dashboard"
              >
                <ArrowBackIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PersonIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("nuevo_usuario_title", "Bienvenido a SPM")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("nuevo_usuario_subtitle", "Configura tu perfil solicitando los permisos que necesitas")}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Right */}
            <Button
              variant="outlined"
              onClick={handleSkip}
              sx={{
                fontWeight: 600,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t("nuevo_usuario_skip", "Ir al Dashboard")}
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Main */}
      <Box component="main" sx={{ maxWidth: 1200, mx: "auto", px: 3, py: 3 }}>
        {error && (
          <Alert
            severity="error"
            onClose={() => setError("")}
            sx={{ mb: 3 }}
          >
            {error}
          </Alert>
        )}

        {/* Info Banner */}
        <Alert severity="info" sx={{ mb: 3 }}>
          {t("nuevo_usuario_info", "Como nuevo usuario tienes rol Solicitante. Puedes solicitar permisos adicionales que seran revisados por un administrador.")}
        </Alert>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            }}
          >
            {/* Permisos Actuales */}
            <Paper variant="outlined" sx={{ boxShadow: 1 }}>
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                  bgcolor: "grey.50",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PersonIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("nuevo_usuario_permisos_actuales", "Permisos Actuales")}
                  </Typography>
                </Stack>
              </Box>

              <FormSection title={t("nuevo_usuario_rol", "Rol")}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <ShieldIcon sx={{ fontSize: 20, color: "info.main" }} />
                  <Chip
                    label="Solicitante"
                    color="info"
                    variant="outlined"
                    size="small"
                    sx={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}
                  />
                </Stack>
              </FormSection>

              <FormSection title={t("nuevo_usuario_organizacion", "Organizacion")}>
                <Stack spacing={1.5}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "text.secondary" }}>
                      <BusinessIcon sx={{ fontSize: 18 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t("nuevo_usuario_sector", "Sector")}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.disabled">-</Typography>
                  </Paper>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "text.secondary" }}>
                      <BusinessIcon sx={{ fontSize: 18 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t("nuevo_usuario_centros", "Centros")}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.disabled">-</Typography>
                  </Paper>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "text.secondary" }}>
                      <WarehouseIcon sx={{ fontSize: 18 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t("nuevo_usuario_almacenes", "Almacenes")}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.disabled">-</Typography>
                  </Paper>
                </Stack>
              </FormSection>
            </Paper>

            {/* Solicitar Permisos */}
            <Paper variant="outlined" sx={{ boxShadow: 1 }}>
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                  bgcolor: "grey.50",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ShieldIcon sx={{ fontSize: 20, color: "info.main" }} />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("nuevo_usuario_solicitar", "Solicitar Permisos")}
                  </Typography>
                </Stack>
              </Box>

              <FormSection title={t("nuevo_usuario_rol_deseado", "Rol Deseado")}>
                <FormSelect
                  value={form.rol_solicitado}
                  onChange={(e) => setForm(prev => ({ ...prev, rol_solicitado: e.target.value }))}
                  options={catalogos.roles.map(r => ({ value: r.nombre, label: r.nombre }))}
                  placeholder={t("common_seleccionar", "Seleccionar...")}
                />
              </FormSection>

              <FormSection title={t("nuevo_usuario_sector", "Sector")}>
                <FormSelect
                  value={form.sector_nuevo}
                  onChange={(e) => setForm(prev => ({ ...prev, sector_nuevo: e.target.value }))}
                  options={catalogos.sectores}
                  placeholder={t("common_seleccionar", "Seleccionar...")}
                />
              </FormSection>

              <FormSection title={t("nuevo_usuario_centros", "Centros")}>
                <MultiSelectChips
                  options={catalogos.centros}
                  value={form.centros_nuevos}
                  onChange={(val) => setForm(prev => ({ ...prev, centros_nuevos: val }))}
                  emptyText={t("common_sin_opciones", "Sin opciones disponibles")}
                />
              </FormSection>

              <FormSection title={t("nuevo_usuario_almacenes", "Almacenes")}>
                <MultiSelectChips
                  options={catalogos.almacenes}
                  value={form.almacenes_nuevos}
                  onChange={(val) => setForm(prev => ({ ...prev, almacenes_nuevos: val }))}
                  emptyText={t("common_sin_opciones", "Sin opciones disponibles")}
                />
              </FormSection>

              <FormSection title={t("nuevo_usuario_justificacion", "Justificacion")}>
                <FormTextarea
                  value={form.justificacion}
                  onChange={(e) => setForm(prev => ({ ...prev, justificacion: e.target.value }))}
                  placeholder={t("nuevo_usuario_justificacion_placeholder", "Explica brevemente por que necesitas estos permisos...")}
                  rows={3}
                  helper={t("common_recomendado", "Recomendado")}
                />
              </FormSection>
            </Paper>
          </Box>
        )}

        {/* Footer Actions */}
        {!loading && (
          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1.5}
            sx={{ mt: 3 }}
          >
            <Button
              variant="outlined"
              onClick={handleSkip}
              disabled={submitting}
              sx={{
                fontWeight: 600,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t("nuevo_usuario_skip", "Ir al Dashboard")}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting && <CircularProgress size={16} color="inherit" />}
              sx={{
                px: 3,
                fontWeight: 600,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {submitting ? t("common_enviando", "Enviando...") : t("nuevo_usuario_submit", "Enviar Solicitud")}
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
