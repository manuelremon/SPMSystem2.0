import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as account from "../services/account";
import { useI18n } from "../context/i18n";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
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
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import MessageIcon from "@mui/icons-material/Message";
import SendIcon from "@mui/icons-material/Send";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LockIcon from "@mui/icons-material/Lock";
import TuneIcon from "@mui/icons-material/Tune";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HistoryIcon from "@mui/icons-material/History";
import { PushNotificationBanner } from "../components/ui/PushNotificationToggle";

const initialPending = {
  sector_nuevo: "",
  centros_nuevos: [],
  almacenes_nuevos: [],
  jefe_nuevo: "",
  gerente1_nuevo: "",
  gerente2_nuevo: "",
};

export default function MiCuenta() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({});
  const [catalogos, setCatalogos] = useState({ sectores: [], centros: [], almacenes: [], usuarios: [] });
  const [pendingChanges, setPendingChanges] = useState(initialPending);
  const [solicitudes, setSolicitudes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [mailBackup, setMailBackup] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");

  const [passwordForm, setPasswordForm] = useState({ nueva: "", repetir: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const [savingRequest, setSavingRequest] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [messageToAdmin, setMessageToAdmin] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [cancelingRequest, setCancelingRequest] = useState(null);

  const [notifPrefs, setNotifPrefs] = useState({
    pushEnabled: true,
    soundEnabled: true,
    notifSolicitudes: true,
    notifAprobaciones: true,
    notifMensajes: true,
    notifPresupuestos: true,
    notifMrp: true,
    notifSla: true,
  });
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);
  const [notifPrefsMessage, setNotifPrefsMessage] = useState("");

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([loadProfile(), loadCatalogs(), loadSolicitudes(), loadNotifPrefs()]);
      } catch (err) {
        setError("No se pudo cargar Mi Cuenta. Intenta recargar.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadProfile = async () => {
    const res = await account.getProfile();
    const data = res.data || {};
    setProfile(data);
    setPhone(data.telefono || "");
    setMailBackup(data.mail_respaldo || "");
  };

  const loadCatalogs = async () => {
    try {
      const [sectores, centros, almacenes, usuarios] = await Promise.all([
        account.catalogs.sectores(),
        account.catalogs.centros(),
        account.catalogs.almacenes(),
        account.catalogs.usuarios().catch(() => ({ data: [] })),
      ]);
      setCatalogos({
        sectores: sectores.data || [],
        centros: centros.data || [],
        almacenes: almacenes.data || [],
        usuarios: usuarios.data || [],
      });
    } catch (err) {
      setError("No se pudieron cargar catálogos.");
    }
  };

  const loadSolicitudes = async () => {
    const res = await account.getProfileChanges();
    setSolicitudes(res.data || []);
  };

  const loadNotifPrefs = async () => {
    const res = await account.getNotificationPreferences();
    if (res.data?.ok && res.data?.preferences) {
      const prefs = res.data.preferences;
      setNotifPrefs(prefs);
      localStorage.setItem('spm-notification-prefs', JSON.stringify({ soundEnabled: prefs.soundEnabled }));
    }
  };

  const handleNotifPrefChange = (key) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setNotifPrefsMessage("");
  };

  const saveNotifPrefs = async () => {
    setSavingNotifPrefs(true);
    setNotifPrefsMessage("");
    try {
      await account.updateNotificationPreferences(notifPrefs);
      localStorage.setItem('spm-notification-prefs', JSON.stringify({ soundEnabled: notifPrefs.soundEnabled }));
      setNotifPrefsMessage("Preferencias guardadas correctamente.");
      setTimeout(() => setNotifPrefsMessage(""), 3000);
    } catch (err) {
      setNotifPrefsMessage(err.response?.data?.error?.message || "No se pudieron guardar las preferencias.");
    } finally {
      setSavingNotifPrefs(false);
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordMessage("");
  };

  const submitSecurity = async () => {
    if (!passwordForm.nueva && !mailBackup) {
      setPasswordMessage("Ingresa una nueva contraseña o mail de respaldo.");
      return;
    }
    if (passwordForm.nueva) {
      if (passwordForm.nueva.length < 8) {
        setPasswordMessage("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
      if (passwordForm.nueva !== passwordForm.repetir) {
        setPasswordMessage("Las contraseñas no coinciden.");
        return;
      }
    }
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      if (passwordForm.nueva) {
        await account.updatePassword({
          password_nueva: passwordForm.nueva,
          password_nueva_repetida: passwordForm.repetir,
        });
      }
      if (mailBackup && mailBackup !== profile.mail_respaldo) {
        await account.updateContact({ mail_respaldo: mailBackup });
      }
      setPasswordMessage("Datos de seguridad actualizados correctamente.");
      setPasswordForm({ nueva: "", repetir: "" });
      setTimeout(() => setPasswordMessage(""), 3000);
    } catch (err) {
      setPasswordMessage(err.response?.data?.error?.message || "Error al actualizar seguridad.");
    } finally {
      setSavingPassword(false);
    }
  };

  const submitPhone = async () => {
    if (!phone || phone.length < 6) {
      setPhoneMessage("Ingresa un teléfono válido (mín. 6 caracteres).");
      return;
    }
    setSavingPhone(true);
    setPhoneMessage("");
    try {
      await account.updateContact({ telefono: phone });
      setPhoneMessage("Teléfono actualizado correctamente.");
      setTimeout(() => setPhoneMessage(""), 3000);
    } catch (err) {
      setPhoneMessage(err.response?.data?.error?.message || "Error al guardar teléfono.");
    } finally {
      setSavingPhone(false);
    }
  };

  const onMultiSelect = (e, field) => {
    const { value } = e.target;
    setPendingChanges((prev) => ({ ...prev, [field]: typeof value === 'string' ? value.split(',') : value }));
    setRequestMessage("");
  };

  const submitProfileRequest = async () => {
    const hasChanges = Object.values(pendingChanges).some(
      (v) => (Array.isArray(v) ? v.length > 0 : v)
    );
    if (!hasChanges) {
      setRequestMessage("Selecciona al menos un cambio para solicitar.");
      return;
    }
    setSavingRequest(true);
    setRequestMessage("");
    try {
      await account.requestProfileChange(pendingChanges);
      setRequestMessage("Solicitud enviada. Será revisada por un administrador.");
      setPendingChanges(initialPending);
      await loadSolicitudes();
      setTimeout(() => setRequestMessage(""), 4000);
    } catch (err) {
      setRequestMessage(err.response?.data?.error?.message || "Error al enviar solicitud.");
    } finally {
      setSavingRequest(false);
    }
  };

  const handleCancelRequest = async (solicitud) => {
    if (!solicitud?.id) return;
    setCancelingRequest(solicitud.id);
    try {
      await account.cancelProfileRequest(solicitud.id);
      await loadSolicitudes();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al cancelar solicitud.");
    } finally {
      setCancelingRequest(null);
    }
  };

  const handleOpenMessageModal = (solicitud) => {
    setSelectedSolicitud(solicitud);
    setMessageToAdmin("");
    setMessageModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!messageToAdmin.trim() || !selectedSolicitud?.id) return;
    setSendingMessage(true);
    try {
      await account.sendMessageToAdmin(selectedSolicitud.id, { mensaje: messageToAdmin.trim() });
      setMessageModalOpen(false);
      setMessageToAdmin("");
      setSelectedSolicitud(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al enviar mensaje.");
    } finally {
      setSendingMessage(false);
    }
  };
  const getStatusColor = (estado) => {
    switch (estado) {
      case "aprobada":
      case "aprobado":
        return "success";
      case "rechazada":
      case "rechazado":
        return "error";
      case "pendiente":
        return "warning";
      default:
        return "default";
    }
  };


  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: "text.disabled", "&:hover": { color: "text.secondary", bgcolor: "background.paper", border: 1, borderColor: "divider" } }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mi Cuenta</Typography>
        </Box>
        <Grid container spacing={2}>
          {[...Array(6)].map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
                <Skeleton width="40%" height={28} sx={{ mb: 1 }} />
                <Stack spacing={1.5}>
                  <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
                  <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
                  <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ color: "text.disabled", "&:hover": { color: "text.secondary", bgcolor: "background.paper", border: 1, borderColor: "divider" } }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mi Cuenta</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <PushNotificationBanner />

      {/* Datos de Identidad + Contacto */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", display: "flex", alignItems: "center", gap: 1 }}>
              <PersonIcon fontSize="small" sx={{ color: "primary.main" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Datos de Identidad</Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Stack spacing={1.5}>
                <ReadOnlyField label="Nombre y Apellido" value={profile.nombre_apellido || "-"} />
                <ReadOnlyField label="ID Usuario SPM" value={profile.id_usuario_spm || "-"} />
                <ReadOnlyField label="Rol" value={profile.rol_spm || "-"} />
                <ReadOnlyField label="Puesto" value={profile.puesto || "-"} />
                <ReadOnlyField label="Sector" value={profile.sector_actual || "-"} />
                <ReadOnlyField label="Centros" value={(profile.centros_actuales || []).join(", ") || "-"} />
                <ReadOnlyField label="Almacenes" value={(profile.almacenes_actuales || []).join(", ") || "-"} />
                <ReadOnlyField label="Jefe" value={profile.jefe_actual || "-"} />
                <ReadOnlyField label="Gerente 1" value={profile.gerente1_actual || "-"} />
                <ReadOnlyField label="Gerente 2" value={profile.gerente2_actual || "-"} />
              </Stack>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Stack spacing={2}>
            {/* Contacto */}
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", display: "flex", alignItems: "center", gap: 1 }}>
                <PhoneIcon fontSize="small" sx={{ color: "primary.main" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Datos de Contacto</Typography>
              </Box>
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={1.5}>
                  <ReadOnlyField label="Mail" value={profile.mail || "-"} />
                  <TextField fullWidth size="small" label="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
                  {phoneMessage && <Alert severity={phoneMessage.includes("correctamente") ? "success" : "warning"} sx={{ py: 0 }}>{phoneMessage}</Alert>}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="contained" size="small" disabled={savingPhone} onClick={submitPhone} sx={{ textTransform: "none" }}>
                      {savingPhone ? "Guardando..." : "Guardar contacto"}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Paper>

            {/* Seguridad */}
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", display: "flex", alignItems: "center", gap: 1 }}>
                <LockIcon fontSize="small" sx={{ color: "primary.main" }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Seguridad</Typography>
              </Box>
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={1.5}>
                  <TextField fullWidth size="small" type="password" label="Nueva Contrasena" value={passwordForm.nueva} onChange={(e) => handlePasswordChange("nueva", e.target.value)} autoComplete="new-password" placeholder="Min 8 caracteres" />
                  <TextField fullWidth size="small" type="password" label="Repetir Nueva Contrasena" value={passwordForm.repetir} onChange={(e) => handlePasswordChange("repetir", e.target.value)} autoComplete="new-password" placeholder="Repite la contrasena" />
                  <TextField fullWidth size="small" type="email" label="Mail de Respaldo" value={mailBackup} onChange={(e) => setMailBackup(e.target.value)} autoComplete="email" placeholder="ejemplo@respaldo.com" />
                  {passwordMessage && <Alert severity={passwordMessage.includes("correctamente") ? "success" : "warning"} sx={{ py: 0 }}>{passwordMessage}</Alert>}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="contained" size="small" disabled={savingPassword} onClick={submitSecurity} sx={{ textTransform: "none" }}>
                      {savingPassword ? "Guardando..." : "Guardar seguridad"}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* Preferencias de Notificacion */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", display: "flex", alignItems: "center", gap: 1 }}>
          <NotificationsIcon fontSize="small" sx={{ color: "primary.main" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Preferencias de Notificacion</Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={1}>
            {[
              { key: "pushEnabled", label: "Push Notifications" },
              { key: "soundEnabled", label: "Sonido" },
              { key: "notifSolicitudes", label: "Solicitudes" },
              { key: "notifAprobaciones", label: "Aprobaciones" },
              { key: "notifMensajes", label: "Mensajes" },
              { key: "notifPresupuestos", label: "Presupuestos" },
              { key: "notifMrp", label: "Alertas MRP" },
              { key: "notifSla", label: "Alertas SLA" },
            ].map(({ key, label }) => (
              <Grid item xs={6} sm={4} md={3} key={key}>
                <FormControlLabel
                  control={<Switch checked={!!notifPrefs[key]} onChange={() => handleNotifPrefChange(key)} size="small" />}
                  label={<Typography variant="body2">{label}</Typography>}
                />
              </Grid>
            ))}
          </Grid>
          {notifPrefsMessage && <Alert severity="success" sx={{ mt: 1.5, py: 0 }}>{notifPrefsMessage}</Alert>}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" size="small" disabled={savingNotifPrefs} onClick={saveNotifPrefs} sx={{ textTransform: "none" }}>
              {savingNotifPrefs ? "Guardando..." : "Guardar preferencias"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Configuracion sujeta a aprobacion */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", display: "flex", alignItems: "center", gap: 1 }}>
          <TuneIcon fontSize="small" sx={{ color: "primary.main" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Configuracion sujeta a aprobacion</Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>Solicita cambios de sector, centros y responsables. Los cambios seran revisados por un administrador.</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Sector</InputLabel>
                <Select value={pendingChanges.sector_nuevo} label="Sector" onChange={(e) => { setPendingChanges((prev) => ({ ...prev, sector_nuevo: e.target.value })); setRequestMessage(""); }}>
                  <MenuItem value="">Sin cambio</MenuItem>
                  {catalogos.sectores.map((s) => (
                    <MenuItem key={s.id || s.nombre || s} value={s.nombre || s}>{s.nombre || s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Centros</InputLabel>
                <Select multiple value={pendingChanges.centros_nuevos} label="Centros" onChange={(e) => onMultiSelect(e, "centros_nuevos")} renderValue={(selected) => selected.join(", ")}>
                  {catalogos.centros.map((c) => (
                    <MenuItem key={c.id || c.nombre || c} value={c.nombre || c.id || c}>{c.nombre || c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Almacenes</InputLabel>
                <Select multiple value={pendingChanges.almacenes_nuevos} label="Almacenes" onChange={(e) => onMultiSelect(e, "almacenes_nuevos")} renderValue={(selected) => selected.join(", ")}>
                  {catalogos.almacenes.map((a) => (
                    <MenuItem key={a.id || a.nombre || a} value={a.nombre || a.id || a}>{a.nombre || a}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Jefe</InputLabel>
                <Select value={pendingChanges.jefe_nuevo} label="Jefe" onChange={(e) => { setPendingChanges((prev) => ({ ...prev, jefe_nuevo: e.target.value })); setRequestMessage(""); }}>
                  <MenuItem value="">Sin cambio</MenuItem>
                  {catalogos.usuarios.map((u) => (
                    <MenuItem key={u.id_spm || u.id} value={u.id_spm || u.id}>{u.nombre} {u.apellido}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Gerente 1</InputLabel>
                <Select value={pendingChanges.gerente1_nuevo} label="Gerente 1" onChange={(e) => { setPendingChanges((prev) => ({ ...prev, gerente1_nuevo: e.target.value })); setRequestMessage(""); }}>
                  <MenuItem value="">Sin cambio</MenuItem>
                  {catalogos.usuarios.map((u) => (
                    <MenuItem key={u.id_spm || u.id} value={u.id_spm || u.id}>{u.nombre} {u.apellido}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Gerente 2</InputLabel>
                <Select value={pendingChanges.gerente2_nuevo} label="Gerente 2" onChange={(e) => { setPendingChanges((prev) => ({ ...prev, gerente2_nuevo: e.target.value })); setRequestMessage(""); }}>
                  <MenuItem value="">Sin cambio</MenuItem>
                  {catalogos.usuarios.map((u) => (
                    <MenuItem key={u.id_spm || u.id} value={u.id_spm || u.id}>{u.nombre} {u.apellido}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {requestMessage && <Alert severity={requestMessage.includes("enviada") ? "success" : "warning"} sx={{ mt: 2, py: 0 }}>{requestMessage}</Alert>}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" size="small" disabled={savingRequest} onClick={submitProfileRequest} sx={{ textTransform: "none" }}>
              {savingRequest ? "Enviando..." : "Solicitar actualizacion"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Historial de solicitudes */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", display: "flex", alignItems: "center", gap: 1 }}>
          <HistoryIcon fontSize="small" sx={{ color: "primary.main" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Solicitudes de actualizacion de perfil</Typography>
        </Box>
        <Box sx={{ p: solicitudes.length === 0 ? 2.5 : 0 }}>
          {solicitudes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Sin solicitudes pendientes.</Typography>
          ) : (
            <SolicitudesTable
              data={solicitudes}
              onMessage={(solicitud) => {
                setSelectedSolicitud(solicitud);
                setMessageModalOpen(true);
              }}
              onCancel={(solicitud) => handleCancelRequest(solicitud)}
            />
          )}
        </Box>
      </Paper>

      {/* Modal de mensaje */}
      <Dialog open={messageModalOpen} onClose={() => setMessageModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          Mensaje al administrador
          <IconButton size="small" onClick={() => setMessageModalOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Solicitud #{selectedSolicitud?.id}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Mensaje"
            value={messageToAdmin}
            onChange={(e) => setMessageToAdmin(e.target.value)}
            placeholder="Escribe tu consulta al administrador..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMessageModalOpen(false)} sx={{ textTransform: "none" }}>Cancelar</Button>
          <Button
            variant="contained"
            size="small"
            disabled={sendingMessage || !messageToAdmin.trim()}
            onClick={handleSendMessage}
            startIcon={<SendIcon />}
            sx={{ textTransform: "none" }}
          >
            {sendingMessage ? "Enviando..." : "Enviar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * Tabla de solicitudes de cambio de perfil migrada a SPMAgGrid
 */
function SolicitudesTable({ data, onMessage, onCancel }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, idx) => ({ ...item, id: item.id || idx }));
  }, [data]);

  const columnDefs = useMemo(() => [
    {
      field: 'tipo_cambio',
      headerName: t('common_type', 'Tipo de cambio'),
      flex: 0.35,
      minWidth: 120,
      valueFormatter: (params) => {
        const types = {
          'sector': 'Sector',
          'centros': 'Centros',
          'almacenes': 'Almacenes',
          'jefe': 'Jefe',
          'gerente': 'Gerente'
        };
        return types[params.value] || params.value || '-';
      },
    },
    {
      field: 'estado',
      headerName: t('common_status', 'Estado'),
      flex: 0.25,
      minWidth: 110,
      cellRenderer: (params) => {
        const estado = params.data?.estado?.toLowerCase() || 'pendiente';
        const statusConfig = {
          'aprobado': { bg: 'var(--success-soft)', color: 'var(--success)' },
          'rechazado': { bg: 'var(--danger-soft)', color: 'var(--danger)' },
          'pendiente': { bg: 'var(--warning-soft)', color: 'var(--warning)' },
        };
        const config = statusConfig[estado] || statusConfig.pendiente;
        return (
          <Chip
            label={estado.charAt(0).toUpperCase() + estado.slice(1)}
            size="small"
            sx={{
              bgcolor: config.bg,
              color: config.color,
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
        );
      },
    },
    {
      field: 'fecha_solicitud',
      headerName: t('common_date', 'Fecha solicitud'),
      flex: 0.3,
      minWidth: 100,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        try {
          return new Date(params.value).toLocaleDateString('es-AR');
        } catch {
          return params.value;
        }
      },
    },
    {
      field: 'mensaje_admin',
      headerName: t('common_admin_message', 'Comentario'),
      flex: 0.8,
      minWidth: 180,
      valueFormatter: (params) => params.value || '-',
    },
    {
      field: 'acciones',
      headerName: t('common_actions', 'Acciones'),
      flex: 0.3,
      minWidth: 100,
      sortable: false,
      filter: false,
      cellRenderer: (params) => {
        const estado = params.data?.estado?.toLowerCase() || 'pendiente';
        return (
          <Stack direction="row" spacing={0.5}>
            {estado === 'pendiente' && (
              <>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<MessageIcon sx={{ fontSize: 16 }} />}
                  onClick={() => onMessage && onMessage(params.data)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0.5 }}
                >
                  Mensaje
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => onCancel && onCancel(params.data)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0.5, color: 'var(--danger)' }}
                >
                  Cancelar
                </Button>
              </>
            )}
          </Stack>
        );
      },
    },
  ], [t, onMessage, onCancel]);

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={300}
      pagination={true}
      paginationPageSize={10}
      enableQuickFilter={true}
      exportFileName="cambios_perfil_pendientes"
      emptyMessage={t('common_no_data', 'Sin solicitudes pendientes')}
    />
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={value}
      InputProps={{ readOnly: true }}
      variant="filled"
      sx={{ '& .MuiInputBase-input': { bgcolor: 'action.hover' } }}
    />
  );
}
