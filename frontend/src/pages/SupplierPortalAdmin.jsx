/**
 * SupplierPortalAdmin - Admin page for supplier portal management
 *
 * Tabs: Portal Users | Share Forecasts | Activity Log
 * Manage supplier portal users, share forecast data, and view activity.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDateTime } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const USER_ESTADO_COLORS = {
  activo: 'success',
  inactivo: 'default',
  bloqueado: 'error',
};

const USER_ESTADO_LABELS = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  bloqueado: 'Bloqueado',
};

const ACCION_COLORS = {
  login: 'info',
  logout: 'default',
  view_po: 'primary',
  create_asn: 'success',
  view_forecast: 'warning',
  update_profile: 'secondary',
};

const INITIAL_USER_FORM = {
  proveedor_cuit: '',
  email: '',
  nombre: '',
  password: '',
};

function getNextMonths(count) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push({
      value: `${yyyy}-${mm}`,
      label: d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }),
    });
  }
  return months;
}

export default function SupplierPortalAdmin() {
  const { t } = useI18n();
  const toast = useToast();

  const [tabValue, setTabValue] = useState(0);

  // --- Users Tab ---
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [userForm, setUserForm] = useState(INITIAL_USER_FORM);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [togglingUser, setTogglingUser] = useState(null);

  // --- Forecasts Tab ---
  const [proveedores, setProveedores] = useState([]);
  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [materialsInput, setMaterialsInput] = useState('');
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [sharingForecast, setSharingForecast] = useState(false);
  const nextMonths = useMemo(() => getNextMonths(6), []);

  // --- Activity Tab ---
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/supplier-portal/admin/users');
      if (res.data?.ok) {
        setUsers(res.data.users || res.data.items || []);
      }
    } catch {
      toast.error(t('portal_error_users', 'Error al cargar usuarios del portal'));
    } finally {
      setUsersLoading(false);
    }
  }, [t, toast]);

  // Fetch proveedores for forecast sharing
  const fetchProveedores = useCallback(async () => {
    try {
      const res = await api.get('/supplier-portal/admin/users');
      if (res.data?.ok) {
        const cuits = [...new Set((res.data.users || []).map((u) => u.proveedor_cuit).filter(Boolean))];
        setProveedores(cuits);
      }
    } catch {
      // Non-critical
    }
  }, []);

  // Fetch activity
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await api.get('/supplier-portal/admin/activity');
      if (res.data?.ok) {
        setActivity(res.data.activity || res.data.items || []);
      }
    } catch {
      toast.error(t('portal_error_activity', 'Error al cargar actividad'));
    } finally {
      setActivityLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (tabValue === 0) fetchUsers();
    if (tabValue === 1) fetchProveedores();
    if (tabValue === 2) fetchActivity();
  }, [tabValue, fetchUsers, fetchProveedores, fetchActivity]);

  // User form
  const handleUserFormChange = useCallback((field, value) => {
    setUserForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateUser = useCallback(async () => {
    if (!userForm.proveedor_cuit.trim() || !userForm.email.trim() || !userForm.nombre.trim() || !userForm.password.trim()) {
      toast.warning(t('portal_user_required', 'Complete todos los campos'));
      return;
    }
    setSubmittingUser(true);
    try {
      const res = await api.post('/supplier-portal/admin/users', userForm);
      if (res.data?.ok) {
        toast.success(t('portal_user_created', 'Usuario de portal creado'));
        setCreateUserOpen(false);
        setUserForm(INITIAL_USER_FORM);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('portal_error_create_user', 'Error al crear usuario'));
    } finally {
      setSubmittingUser(false);
    }
  }, [userForm, t, toast, fetchUsers]);

  const handleToggleUser = useCallback(async (user) => {
    const newEstado = user.estado === 'activo' ? 'inactivo' : 'activo';
    setTogglingUser(user.id);
    try {
      const res = await api.put(`/supplier-portal/admin/users/${user.id}`, { estado: newEstado });
      if (res.data?.ok) {
        toast.success(t('portal_user_updated', 'Estado de usuario actualizado'));
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('portal_error_toggle', 'Error al cambiar estado'));
    } finally {
      setTogglingUser(null);
    }
  }, [t, toast, fetchUsers]);

  // Share forecast
  const handlePeriodToggle = useCallback((period) => {
    setSelectedPeriods((prev) =>
      prev.includes(period) ? prev.filter((p) => p !== period) : [...prev, period]
    );
  }, []);

  const handleShareForecast = useCallback(async () => {
    if (!selectedProveedor || !materialsInput.trim() || selectedPeriods.length === 0) {
      toast.warning(t('portal_forecast_required', 'Seleccione proveedor, materiales y periodos'));
      return;
    }
    setSharingForecast(true);
    try {
      const materials = materialsInput.split(',').map((m) => m.trim()).filter(Boolean);
      const res = await api.post('/supplier-portal/admin/share-forecast', {
        proveedor_cuit: selectedProveedor,
        materiales: materials,
        periodos: selectedPeriods,
      });
      if (res.data?.ok) {
        toast.success(t('portal_forecast_shared', 'Forecasts compartidos'));
        setMaterialsInput('');
        setSelectedPeriods([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('portal_error_share', 'Error al compartir forecasts'));
    } finally {
      setSharingForecast(false);
    }
  }, [selectedProveedor, materialsInput, selectedPeriods, t, toast]);

  // Column defs
  const userColumnDefs = useMemo(() => [
    { field: 'email', headerName: t('portal_user_email', 'Email'), flex: 1.5, minWidth: 200 },
    { field: 'nombre', headerName: t('portal_user_nombre', 'Nombre'), flex: 1, minWidth: 160 },
    { field: 'proveedor_cuit', headerName: t('portal_user_cuit', 'Proveedor CUIT'), flex: 1, minWidth: 150 },
    {
      field: 'estado',
      headerName: t('portal_user_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={USER_ESTADO_LABELS[p.value] || p.value || '-'}
          color={USER_ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'ultimo_login',
      headerName: t('portal_user_login', 'Ultimo Login'),
      width: 150,
      valueFormatter: (p) => formatDateTime(p.value),
    },
    {
      headerName: t('portal_user_acciones', 'Acciones'),
      width: 160,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row) return null;
        const isActive = row.estado === 'activo';
        const isToggling = togglingUser === row.id;
        return (
          <Button
            size="small"
            variant="outlined"
            color={isActive ? 'warning' : 'success'}
            startIcon={isToggling ? <CircularProgress size={14} /> : isActive ? <ToggleOffIcon /> : <ToggleOnIcon />}
            onClick={(e) => { e.stopPropagation(); handleToggleUser(row); }}
            disabled={isToggling}
          >
            {isActive ? t('portal_desactivar', 'Desactivar') : t('portal_activar', 'Activar')}
          </Button>
        );
      },
    },
  ], [t, togglingUser, handleToggleUser]);

  const activityColumnDefs = useMemo(() => [
    {
      field: 'fecha',
      headerName: t('portal_act_fecha', 'Fecha'),
      width: 160,
      valueFormatter: (p) => formatDateTime(p.value),
      sort: 'desc',
    },
    { field: 'usuario', headerName: t('portal_act_usuario', 'Usuario'), flex: 1, minWidth: 160 },
    {
      field: 'accion',
      headerName: t('portal_act_accion', 'Accion'),
      width: 140,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={p.value || '-'}
          color={ACCION_COLORS[p.value] || 'default'}
          variant="outlined"
        />
      ),
    },
    { field: 'entidad', headerName: t('portal_act_entidad', 'Entidad'), flex: 1, minWidth: 160 },
    { field: 'ip', headerName: t('portal_act_ip', 'IP'), width: 140 },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <PeopleIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('portal_title', 'Portal de Proveedores - Admin')}
          </Typography>
        </Stack>
      </Stack>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('portal_tab_users', 'Usuarios Portal')} icon={<PeopleIcon />} iconPosition="start" />
          <Tab label={t('portal_tab_forecasts', 'Compartir Forecasts')} icon={<ShareIcon />} iconPosition="start" />
          <Tab label={t('portal_tab_activity', 'Actividad')} icon={<HistoryIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Users */}
      {tabValue === 0 && (
        <>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setCreateUserOpen(true)}
              aria-label={t('portal_new_user', 'Crear Usuario')}
            >
              {t('portal_new_user', 'Crear Usuario')}
            </Button>
          </Stack>

          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('portal_tab_users', 'Usuarios Portal')}
          >
            <SPMAgGrid
              columnDefs={userColumnDefs}
              rowData={users}
              loading={usersLoading}
              height={450}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="portal_usuarios"
              emptyMessage={t('portal_no_users', 'No hay usuarios de portal registrados')}
              getRowId={(params) => String(params.data.id)}
            />
          </Paper>
        </>
      )}

      {/* Tab 1: Share Forecasts */}
      {tabValue === 1 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            {t('portal_share_title', 'Compartir Forecasts con Proveedores')}
          </Typography>
          <Stack spacing={3}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('portal_share_proveedor', 'Proveedor')}</InputLabel>
              <Select
                value={selectedProveedor}
                label={t('portal_share_proveedor', 'Proveedor')}
                onChange={(e) => setSelectedProveedor(e.target.value)}
              >
                {proveedores.map((cuit) => (
                  <MenuItem key={cuit} value={cuit}>{cuit}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t('portal_share_materials', 'Materiales (codigos separados por coma)')}
              value={materialsInput}
              onChange={(e) => setMaterialsInput(e.target.value)}
              fullWidth
              size="small"
              placeholder="MAT001, MAT002, MAT003"
              helperText={t('portal_share_materials_help', 'Ingrese los codigos de material separados por coma')}
            />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('portal_share_periods', 'Periodos (proximos 6 meses)')}
              </Typography>
              <FormGroup row>
                {nextMonths.map((m) => (
                  <FormControlLabel
                    key={m.value}
                    control={
                      <Checkbox
                        checked={selectedPeriods.includes(m.value)}
                        onChange={() => handlePeriodToggle(m.value)}
                        size="small"
                      />
                    }
                    label={m.label}
                    sx={{ minWidth: 180 }}
                  />
                ))}
              </FormGroup>
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={sharingForecast ? <CircularProgress size={16} /> : <ShareIcon />}
                onClick={handleShareForecast}
                disabled={sharingForecast || !selectedProveedor || !materialsInput.trim() || selectedPeriods.length === 0}
              >
                {t('portal_share_btn', 'Compartir')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Tab 2: Activity */}
      {tabValue === 2 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('portal_tab_activity', 'Actividad')}
        >
          <SPMAgGrid
            columnDefs={activityColumnDefs}
            rowData={activity}
            loading={activityLoading}
            height={500}
            pagination={true}
            paginationPageSize={25}
            enableQuickFilter={true}
            exportFileName="portal_actividad"
            emptyMessage={t('portal_no_activity', 'Sin actividad registrada')}
            getRowId={(params) => String(params.data.id || `${params.data.fecha}-${params.data.usuario}`)}
          />
        </Paper>
      )}

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onClose={() => setCreateUserOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <PersonAddIcon color="primary" />
            <span>{t('portal_new_user', 'Crear Usuario Portal')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('portal_field_cuit', 'Proveedor CUIT')}
              value={userForm.proveedor_cuit}
              onChange={(e) => handleUserFormChange('proveedor_cuit', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('portal_field_email', 'Email')}
              type="email"
              value={userForm.email}
              onChange={(e) => handleUserFormChange('email', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('portal_field_nombre', 'Nombre')}
              value={userForm.nombre}
              onChange={(e) => handleUserFormChange('nombre', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('portal_field_password', 'Password')}
              type="password"
              value={userForm.password}
              onChange={(e) => handleUserFormChange('password', e.target.value)}
              fullWidth
              required
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateUserOpen(false)} disabled={submittingUser}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={submittingUser || !userForm.proveedor_cuit.trim() || !userForm.email.trim() || !userForm.nombre.trim() || !userForm.password.trim()}
            startIcon={submittingUser ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
