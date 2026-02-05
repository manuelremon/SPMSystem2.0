import { useEffect, useState, useMemo } from "react";
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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MessageIcon from "@mui/icons-material/Message";
import SendIcon from "@mui/icons-material/Send";
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
    // Security submission logic...
  };

  const submitPhone = async () => {
    // Phone submission logic...
  };

  const onMultiSelect = (e, field) => {
    const { value } = e.target;
    setPendingChanges((prev) => ({ ...prev, [field]: typeof value === 'string' ? value.split(',') : value }));
    setRequestMessage("");
  };

  const submitProfileRequest = async () => {
    // Profile request submission logic...
  };

  const handleCancelRequest = async (solicitud) => {
    // Cancel request logic...
  };

  const handleOpenMessageModal = (solicitud) => {
    // Open message modal logic...
  };

  const handleSendMessage = async () => {
    // Send message logic...
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
      <Stack spacing={3}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mi Cuenta</Typography>
        <Grid container spacing={2}>
          {[...Array(6)].map((_, i) => (
            <Grid item xs={12} lg={6} key={i}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}><Skeleton width="40%" /></Typography>
                <Stack spacing={2}>
                  <Skeleton variant="rectangular" height={40} />
                  <Skeleton variant="rectangular" height={40} />
                  <Skeleton variant="rectangular" height={40} />
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mi Cuenta</Typography>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <PushNotificationBanner />

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" mb={0.5}>Preferencias de Notificacion</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Configura que notificaciones deseas recibir</Typography>
        <Grid container spacing={3}>
          {/* Notification Preferences sections */}
        </Grid>
        {notifPrefsMessage && <Typography variant="body2" color="text.secondary" mt={2}>{notifPrefsMessage}</Typography>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="contained" disabled={savingNotifPrefs} onClick={saveNotifPrefs}>
            {savingNotifPrefs ? "Guardando..." : "Guardar preferencias"}
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight="bold" mb={0.5}>Datos de identidad</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Informacion personal y de cuenta</Typography>
            <Stack spacing={2}>
              <ReadOnlyField label="Nombre y Apellido" value={profile.nombre_apellido || "-"} />
              <ReadOnlyField label="ID Usuario SPM" value={profile.id_usuario_spm || "-"} />
              <ReadOnlyField label="Nombre Usuario" value={profile.nombre_usuario || "-"} />
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight="bold" mb={0.5}>Datos de contacto</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Mail y telefono</Typography>
            <Stack spacing={2}>
              <ReadOnlyField label="Mail" value={profile.mail || "-"} />
              <TextField fullWidth size="small" label="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
              {phoneMessage && <Typography variant="body2" color="text.secondary">{phoneMessage}</Typography>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" disabled={savingPhone} onClick={submitPhone}>
                  {savingPhone ? "Guardando..." : "Guardar contacto"}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight="bold" mb={0.5}>Seguridad</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Contrasena y mail de respaldo</Typography>
            <Stack spacing={2}>
              <TextField fullWidth size="small" type="password" label="Nueva Contrasena" value={passwordForm.nueva} onChange={(e) => handlePasswordChange("nueva", e.target.value)} autoComplete="new-password" placeholder="Min 8 caracteres" />
              <TextField fullWidth size="small" type="password" label="Repetir Nueva Contrasena" value={passwordForm.repetir} onChange={(e) => handlePasswordChange("repetir", e.target.value)} autoComplete="new-password" placeholder="Repite la contrasena" />
              <TextField fullWidth size="small" type="email" label="Mail de Respaldo" value={mailBackup} onChange={(e) => setMailBackup(e.target.value)} autoComplete="email" placeholder="ejemplo@respaldo.com" />
              {passwordMessage && <Typography variant="body2" color="text.secondary">{passwordMessage}</Typography>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" disabled={savingPassword} onClick={submitSecurity}>
                  {savingPassword ? "Guardando..." : "Guardar seguridad"}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight="bold" mb={0.5}>Configuracion sujeta a aprobacion</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Solicita cambios de sector, centros y responsables</Typography>
            <Stack spacing={2}>
              {/* Approval-based settings form fields */}
              {requestMessage && <Typography variant="body2" color="text.secondary">{requestMessage}</Typography>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" disabled={savingRequest} onClick={submitProfileRequest}>
                  {savingRequest ? "Enviando..." : "Solicitar actualizacion"}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" mb={0.5}>Solicitudes de actualizacion de perfil</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Historial de cambios solicitados</Typography>
        {solicitudes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Sin solicitudes pendientes.</Typography>
        ) : (
          <SolicitudesTable
            data={solicitudes}
            onMessage={(solicitud) => {
              setSelectedSolicitud(solicitud);
              setMessageModalOpen(true);
            }}
            onCancel={(solicitud) => setCancelingRequest(solicitud.id)}
          />
        )}
      </Paper>

      <Dialog open={messageModalOpen} onClose={() => setMessageModalOpen(false)} maxWidth="sm" fullWidth>
        {/* Message Dialog */}
      </Dialog>
    </Stack>
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
