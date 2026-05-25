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
import Avatar from "@mui/material/Avatar";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
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
import EmailIcon from "@mui/icons-material/Email";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import BadgeIcon from "@mui/icons-material/Badge";
import GroupIcon from "@mui/icons-material/Group";
import { PushNotificationBanner } from "../components/ui/PushNotificationToggle";

const initialPending = {
  sector_nuevo: "",
  centros_nuevos: [],
  almacenes_nuevos: [],
  jefe_nuevo: "",
  gerente1_nuevo: "",
  gerente2_nuevo: "",
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || "?";
};

const getAvatarColor = (name) => {
  const colors = [
    'var(--primary)', 'var(--success)', 'var(--warning)', 'var(--danger)',
    'var(--purple)', 'var(--accent)', 'var(--purple-light)', 'var(--warning-light)',
  ];
  if (!name) return colors[0];
  const hash = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return colors[hash % colors.length];
};

export default function MiCuenta() {
  const navigate = useNavigate();
  const { t } = useI18n();
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

  const [activeTab, setActiveTab] = useState(0);

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
        setError(t('account_load_error', 'No se pudo cargar Mi Cuenta. Intenta recargar.'));
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
      setError(t('account_catalogs_error', 'No se pudieron cargar catálogos.'));
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
      setNotifPrefsMessage(t('account_notif_saved', 'Preferencias guardadas correctamente.'));
      setTimeout(() => setNotifPrefsMessage(""), 3000);
    } catch (err) {
      setNotifPrefsMessage(err.response?.data?.error?.message || t('account_notif_save_error', 'No se pudieron guardar las preferencias.'));
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
      setPasswordMessage(t('account_password_or_mail_required', 'Ingresa una nueva contraseña o mail de respaldo.'));
      return;
    }
    if (passwordForm.nueva) {
      if (passwordForm.nueva.length < 8) {
        setPasswordMessage(t('account_password_min_length', 'La contraseña debe tener al menos 8 caracteres.'));
        return;
      }
      if (passwordForm.nueva !== passwordForm.repetir) {
        setPasswordMessage(t('account_passwords_mismatch', 'Las contraseñas no coinciden.'));
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
      setPasswordMessage(t('account_security_updated', 'Datos de seguridad actualizados correctamente.'));
      setPasswordForm({ nueva: "", repetir: "" });
      setTimeout(() => setPasswordMessage(""), 3000);
    } catch (err) {
      setPasswordMessage(err.response?.data?.error?.message || t('account_security_error', 'Error al actualizar seguridad.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const submitPhone = async () => {
    if (!phone || phone.length < 6) {
      setPhoneMessage(t('account_phone_invalid', 'Ingresa un teléfono válido (mín. 6 caracteres).'));
      return;
    }
    setSavingPhone(true);
    setPhoneMessage("");
    try {
      await account.updateContact({ telefono: phone });
      setPhoneMessage(t('account_phone_updated', 'Teléfono actualizado correctamente.'));
      setTimeout(() => setPhoneMessage(""), 3000);
    } catch (err) {
      setPhoneMessage(err.response?.data?.error?.message || t('account_phone_error', 'Error al guardar teléfono.'));
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
      setRequestMessage(t('account_request_no_changes', 'Selecciona al menos un cambio para solicitar.'));
      return;
    }
    setSavingRequest(true);
    setRequestMessage("");
    try {
      await account.requestProfileChange(pendingChanges);
      setRequestMessage(t('account_request_sent', 'Solicitud enviada. Será revisada por un administrador.'));
      setPendingChanges(initialPending);
      await loadSolicitudes();
      setTimeout(() => setRequestMessage(""), 4000);
    } catch (err) {
      setRequestMessage(err.response?.data?.error?.message || t('account_request_error', 'Error al enviar solicitud.'));
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
      setError(err.response?.data?.error?.message || t('account_cancel_error', 'Error al cancelar solicitud.'));
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
      setError(err.response?.data?.error?.message || t('account_message_error', 'Error al enviar mensaje.'));
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
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 4 }, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton onClick={() => navigate(-1)} sx={{ color: "text.disabled", "&:hover": { color: "text.secondary", bgcolor: "background.paper", border: 1, borderColor: "divider" } }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('account_title', 'Mi Cuenta')}</Typography>
          </Box>
          {/* Hero skeleton */}
          <Paper variant="outlined" sx={{ p: 3, display: "flex", alignItems: "center", gap: 3 }}>
            <Skeleton variant="circular" width={72} height={72} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="30%" height={32} />
              <Skeleton width="50%" height={20} sx={{ mt: 0.5 }} />
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <Skeleton variant="rounded" width={80} height={24} />
                <Skeleton variant="rounded" width={80} height={24} />
              </Box>
            </Box>
          </Paper>
          {/* Tabs skeleton */}
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Skeleton width="60%" height={40} sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              <Skeleton variant="rectangular" height={40} />
              <Skeleton variant="rectangular" height={40} />
              <Skeleton variant="rectangular" height={40} />
              <Skeleton variant="rectangular" height={40} />
            </Stack>
          </Paper>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 4 }, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: "text.disabled", "&:hover": { color: "text.secondary", bgcolor: "background.paper", border: 1, borderColor: "divider" } }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('account_title', 'Mi Cuenta')}</Typography>
        </Box>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        <PushNotificationBanner />

        {/* Profile Hero Card */}
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, md: 3.5 },
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--primary-muted) 100%)',
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "center", sm: "flex-start" },
            gap: { xs: 2, sm: 3 },
          }}
        >
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: getAvatarColor(profile.nombre_apellido),
              fontSize: '1.75rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(profile.nombre_apellido)}
          </Avatar>
          <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, minWidth: 0, flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {profile.nombre_apellido || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {[profile.puesto, profile.sector_actual].filter(Boolean).join(" · ") || "-"}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <Chip
                label={profile.rol_spm || "-"}
                size="small"
                color="primary"
                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
              />
              <Chip
                icon={<BadgeIcon sx={{ fontSize: 16 }} />}
                label={profile.id_usuario_spm || "-"}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
              <Chip
                icon={<EmailIcon sx={{ fontSize: 16 }} />}
                label={profile.mail || "-"}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            </Box>
          </Box>
        </Paper>

        {/* Tabs Card */}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "grey.50",
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
            }}
          >
            <Tab icon={<PersonIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('account_tab_general', 'General')} />
            <Tab icon={<LockIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('account_tab_security', 'Seguridad')} />
            <Tab icon={<NotificationsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('account_tab_notifications', 'Notificaciones')} />
            <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={t('account_tab_requests', 'Solicitudes')} />
          </Tabs>

          {/* ===== Tab 0 - General ===== */}
          <Box sx={{ display: activeTab === 0 ? 'block' : 'none' }}>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Grid container spacing={3}>
                {/* Left: Información Personal */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    {t('account_identity', 'Información Personal')}
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={12}>
                      <ReadOnlyField label={t('account_full_name', 'Nombre y Apellido')} value={profile.nombre_apellido || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ReadOnlyField label={t('account_user_id', 'ID Usuario SPM')} value={profile.id_usuario_spm || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ReadOnlyField label={t('account_role', 'Rol')} value={profile.rol_spm || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ReadOnlyField label={t('account_position', 'Puesto')} value={profile.puesto || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ReadOnlyField label={t('account_sector', 'Sector')} value={profile.sector_actual || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ReadOnlyField label={t('account_centers', 'Centros')} value={(profile.centros_actuales || []).join(", ") || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <ReadOnlyField label={t('account_warehouses', 'Almacenes')} value={(profile.almacenes_actuales || []).join(", ") || "-"} />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2.5 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    {t('account_chain', 'Cadena de Reporte')}
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <ReadOnlyField label={t('account_boss', 'Jefe')} value={profile.jefe_actual || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <ReadOnlyField label={t('account_manager_1', 'Gerente 1')} value={profile.gerente1_actual || "-"} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <ReadOnlyField label={t('account_manager_2', 'Gerente 2')} value={profile.gerente2_actual || "-"} />
                    </Grid>
                  </Grid>
                </Grid>

                {/* Right: Datos de Contacto */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    {t('account_contact', 'Datos de Contacto')}
                  </Typography>
                  <Box component="form" onSubmit={(e) => { e.preventDefault(); submitPhone(); }}>
                    <Stack spacing={1.5}>
                      <ReadOnlyField label={t('account_mail', 'Mail')} value={profile.mail || "-"} />
                      <TextField fullWidth size="small" label={t('account_phone', 'Telefono')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('account_phone_placeholder', '+34 600 000 000')} />
                      {phoneMessage && <Alert severity={phoneMessage.includes("correctamente") ? "success" : "warning"} sx={{ py: 0 }}>{phoneMessage}</Alert>}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="submit" variant="contained" size="small" disabled={savingPhone} sx={{ textTransform: "none" }}>
                          {savingPhone ? t('common_saving', 'Guardando...') : t('account_save_contact', 'Guardar contacto')}
                        </Button>
                      </Box>
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Box>

          {/* ===== Tab 1 - Seguridad ===== */}
          <Box sx={{ display: activeTab === 1 ? 'block' : 'none' }}>
            <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 560, mx: 'auto' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon fontSize="small" sx={{ color: 'primary.main' }} />
                {t('account_password', 'Cambiar Contraseña')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                {t('account_password_desc', 'Ingresa y confirma tu nueva contraseña para actualizarla.')}
              </Typography>
              <Box component="form" onSubmit={(e) => { e.preventDefault(); submitSecurity(); }}>
                <Stack spacing={1.5}>
                  <TextField fullWidth size="small" type="password" label={t('account_new_password', 'Nueva Contrasena')} value={passwordForm.nueva} onChange={(e) => handlePasswordChange("nueva", e.target.value)} autoComplete="new-password" placeholder={t('account_password_placeholder', 'Min 8 caracteres')} />
                  <TextField fullWidth size="small" type="password" label={t('account_repeat_password', 'Repetir Nueva Contrasena')} value={passwordForm.repetir} onChange={(e) => handlePasswordChange("repetir", e.target.value)} autoComplete="new-password" placeholder={t('account_repeat_password_placeholder', 'Repite la contrasena')} />
                  <TextField fullWidth size="small" type="email" label={t('account_backup_mail', 'Mail de Respaldo')} value={mailBackup} onChange={(e) => setMailBackup(e.target.value)} autoComplete="email" placeholder={t('account_backup_mail_placeholder', 'ejemplo@respaldo.com')} />
                  {passwordMessage && <Alert severity={passwordMessage.includes("correctamente") ? "success" : "warning"} sx={{ py: 0 }}>{passwordMessage}</Alert>}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="submit" variant="contained" size="small" disabled={savingPassword} sx={{ textTransform: "none" }}>
                      {savingPassword ? t('common_saving', 'Guardando...') : t('account_save_security', 'Guardar seguridad')}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Box>

          {/* ===== Tab 2 - Notificaciones ===== */}
          <Box sx={{ display: activeTab === 2 ? 'block' : 'none' }}>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Grid container spacing={2.5}>
                {/* Configuración General */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: '100%' }}>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('account_notif_general', 'Configuración General')}</Typography>
                    </Box>
                    <List dense disablePadding>
                      <ListItem sx={{ px: 2 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}><NotificationsIcon fontSize="small" color="primary" /></ListItemIcon>
                        <ListItemText
                          primary={t('account_push_notifications', 'Notificaciones Push')}
                          secondary={t('account_push_desc', 'Recibir notificaciones del navegador')}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <Switch checked={!!notifPrefs.pushEnabled} onChange={() => handleNotifPrefChange("pushEnabled")} size="small" inputProps={{ 'aria-label': t('account_push_notifications', 'Notificaciones Push') }} />
                      </ListItem>
                      <Divider component="li" />
                      <ListItem sx={{ px: 2 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}><VolumeUpIcon fontSize="small" color="primary" /></ListItemIcon>
                        <ListItemText
                          primary={t('account_sound', 'Sonido')}
                          secondary={t('account_sound_desc', 'Reproducir sonido con cada notificación')}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <Switch checked={!!notifPrefs.soundEnabled} onChange={() => handleNotifPrefChange("soundEnabled")} size="small" inputProps={{ 'aria-label': t('account_sound', 'Sonido') }} />
                      </ListItem>
                    </List>
                  </Box>
                </Grid>

                {/* Flujo de Trabajo */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: '100%' }}>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('account_notif_workflow', 'Flujo de Trabajo')}</Typography>
                    </Box>
                    <List dense disablePadding>
                      {[
                        { key: "notifSolicitudes", label: t('account_notif_requests', 'Solicitudes') },
                        { key: "notifAprobaciones", label: t('account_notif_approvals', 'Aprobaciones') },
                        { key: "notifMensajes", label: t('account_notif_messages', 'Mensajes') },
                        { key: "notifPresupuestos", label: t('account_notif_budgets', 'Presupuestos') },
                      ].map(({ key, label }, idx) => (
                        <Box key={key}>
                          {idx > 0 && <Divider component="li" />}
                          <ListItem sx={{ px: 2 }}>
                            <ListItemText
                              primary={label}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            />
                            <Switch checked={!!notifPrefs[key]} onChange={() => handleNotifPrefChange(key)} size="small" inputProps={{ 'aria-label': label }} />
                          </ListItem>
                        </Box>
                      ))}
                    </List>
                  </Box>
                </Grid>

                {/* Alertas del Sistema */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: '100%' }}>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('account_notif_system', 'Alertas del Sistema')}</Typography>
                    </Box>
                    <List dense disablePadding>
                      {[
                        { key: "notifMrp", label: t('account_notif_mrp', 'Alertas MRP') },
                        { key: "notifSla", label: t('account_notif_sla', 'Alertas SLA') },
                      ].map(({ key, label }, idx) => (
                        <Box key={key}>
                          {idx > 0 && <Divider component="li" />}
                          <ListItem sx={{ px: 2 }}>
                            <ListItemText
                              primary={label}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            />
                            <Switch checked={!!notifPrefs[key]} onChange={() => handleNotifPrefChange(key)} size="small" inputProps={{ 'aria-label': label }} />
                          </ListItem>
                        </Box>
                      ))}
                    </List>
                  </Box>
                </Grid>
              </Grid>

              {notifPrefsMessage && <Alert severity="success" sx={{ mt: 2, py: 0 }}>{notifPrefsMessage}</Alert>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
                <Button variant="contained" size="small" disabled={savingNotifPrefs} onClick={saveNotifPrefs} sx={{ textTransform: "none" }}>
                  {savingNotifPrefs ? t('common_saving', 'Guardando...') : t('account_save_preferences', 'Guardar preferencias')}
                </Button>
              </Box>
            </Box>
          </Box>

          {/* ===== Tab 3 - Solicitudes ===== */}
          <Box sx={{ display: activeTab === 3 ? 'block' : 'none' }}>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {/* Request changes form */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <TuneIcon fontSize="small" sx={{ color: "primary.main" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('account_config_approval', 'Configuracion sujeta a aprobacion')}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>{t('account_config_approval_desc', 'Solicita cambios de sector, centros y responsables. Los cambios seran revisados por un administrador.')}</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t('account_sector', 'Sector')}</InputLabel>
                      <Select value={pendingChanges.sector_nuevo} label={t('account_sector', 'Sector')} onChange={(e) => { setPendingChanges((prev) => ({ ...prev, sector_nuevo: e.target.value })); setRequestMessage(""); }}>
                        <MenuItem value="">{t('account_no_change', 'Sin cambio')}</MenuItem>
                        {catalogos.sectores.map((s) => (
                          <MenuItem key={s.id || s.nombre || s} value={s.nombre || s}>{s.nombre || s}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t('account_centers', 'Centros')}</InputLabel>
                      <Select multiple value={pendingChanges.centros_nuevos} label={t('account_centers', 'Centros')} onChange={(e) => onMultiSelect(e, "centros_nuevos")} renderValue={(selected) => selected.join(", ")}>
                        {catalogos.centros.map((c) => (
                          <MenuItem key={c.id || c.nombre || c} value={c.nombre || c.id || c}>{c.nombre || c}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t('account_warehouses', 'Almacenes')}</InputLabel>
                      <Select multiple value={pendingChanges.almacenes_nuevos} label={t('account_warehouses', 'Almacenes')} onChange={(e) => onMultiSelect(e, "almacenes_nuevos")} renderValue={(selected) => selected.join(", ")}>
                        {catalogos.almacenes.map((a) => (
                          <MenuItem key={a.id || a.nombre || a} value={a.nombre || a.id || a}>{a.nombre || a}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t('account_boss', 'Jefe')}</InputLabel>
                      <Select value={pendingChanges.jefe_nuevo} label={t('account_boss', 'Jefe')} onChange={(e) => { setPendingChanges((prev) => ({ ...prev, jefe_nuevo: e.target.value })); setRequestMessage(""); }}>
                        <MenuItem value="">{t('account_no_change', 'Sin cambio')}</MenuItem>
                        {catalogos.usuarios.map((u) => (
                          <MenuItem key={u.id_spm || u.id} value={u.id_spm || u.id}>{u.nombre} {u.apellido}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t('account_manager_1', 'Gerente 1')}</InputLabel>
                      <Select value={pendingChanges.gerente1_nuevo} label={t('account_manager_1', 'Gerente 1')} onChange={(e) => { setPendingChanges((prev) => ({ ...prev, gerente1_nuevo: e.target.value })); setRequestMessage(""); }}>
                        <MenuItem value="">{t('account_no_change', 'Sin cambio')}</MenuItem>
                        {catalogos.usuarios.map((u) => (
                          <MenuItem key={u.id_spm || u.id} value={u.id_spm || u.id}>{u.nombre} {u.apellido}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t('account_manager_2', 'Gerente 2')}</InputLabel>
                      <Select value={pendingChanges.gerente2_nuevo} label={t('account_manager_2', 'Gerente 2')} onChange={(e) => { setPendingChanges((prev) => ({ ...prev, gerente2_nuevo: e.target.value })); setRequestMessage(""); }}>
                        <MenuItem value="">{t('account_no_change', 'Sin cambio')}</MenuItem>
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
                    {savingRequest ? t('common_sending', 'Enviando...') : t('account_request_update', 'Solicitar actualizacion')}
                  </Button>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Historial de solicitudes */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <HistoryIcon fontSize="small" sx={{ color: "primary.main" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('account_profile_update_requests', 'Solicitudes de actualizacion de perfil')}</Typography>
                </Box>
                {solicitudes.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">{t('account_no_pending_requests', 'Sin solicitudes pendientes.')}</Typography>
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
            </Box>
          </Box>
        </Paper>

        {/* Modal de mensaje */}
        <Dialog open={messageModalOpen} onClose={() => setMessageModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
            {t('account_message_to_admin', 'Mensaje al administrador')}
            <IconButton size="small" onClick={() => setMessageModalOpen(false)}><CloseIcon /></IconButton>
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t('account_request_number', 'Solicitud')} #{selectedSolicitud?.id}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              label={t('account_message', 'Mensaje')}
              value={messageToAdmin}
              onChange={(e) => setMessageToAdmin(e.target.value)}
              placeholder={t('account_message_placeholder', 'Escribe tu consulta al administrador...')}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setMessageModalOpen(false)} sx={{ textTransform: "none" }}>{t('common_cancel', 'Cancelar')}</Button>
            <Button
              variant="contained"
              size="small"
              disabled={sendingMessage || !messageToAdmin.trim()}
              onClick={handleSendMessage}
              startIcon={<SendIcon />}
              sx={{ textTransform: "none" }}
            >
              {sendingMessage ? t('common_sending', 'Enviando...') : t('common_send', 'Enviar')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
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
          'sector': t('account_sector', 'Sector'),
          'centros': t('account_centers', 'Centros'),
          'almacenes': t('account_warehouses', 'Almacenes'),
          'jefe': t('account_boss', 'Jefe'),
          'gerente': t('account_manager', 'Gerente')
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
          'aprobado': { bg: 'var(--success-bg-light)', color: 'var(--success)' },
          'rechazado': { bg: 'var(--danger-bg-light)', color: 'var(--danger)' },
          'pendiente': { bg: 'var(--warning-bg-light)', color: 'var(--warning)' },
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
                  {t('account_message', 'Mensaje')}
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => onCancel && onCancel(params.data)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0.5, color: 'var(--danger)' }}
                >
                  {t('common_cancel', 'Cancelar')}
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
      sx={{
        '& .MuiInputLabel-root': {
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'text.secondary',
        },
        '& .MuiInputBase-input': {
          fontWeight: 500,
          cursor: 'default',
        },
        '& .MuiFilledInput-root': {
          bgcolor: 'grey.50',
          '&:hover': { bgcolor: 'grey.100' },
          '&.Mui-focused': { bgcolor: 'grey.50' },
        },
      }}
    />
  );
}
