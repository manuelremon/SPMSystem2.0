/**
 * CreateSolicitud - Crear nueva solicitud de materiales
 * Full MUI Migration
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { solicitudes } from '../services/spm';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../context/i18n';

// MUI Components
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function getDefaultNeedDate() {
  const d = new Date();
  d.setDate(d.getDate() + 120);
  return d.toISOString().slice(0, 10);
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function CreateSolicitud() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [form, setForm] = useState({
    centro: '',
    sector: '',
    centro_costos: '',
    almacen_virtual: '',
    criticidad: 'Normal',
    fecha_necesidad: getDefaultNeedDate(),
    justificacion: '',
    archivos: [],
  });
  const [catalogos, setCatalogos] = useState({ centros: [], sectores: [], almacenes: [] });
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const token = useMemo(() => localStorage.getItem('token'), []);

  const loadFormCatalogsForNuevaSolicitud = async () => {
    setLoadingCatalogos(true);
    try {
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      let catalogosData = {};
      try {
        const resCatalogos = await api.get('/catalogos', { headers: authHeaders });
        catalogosData = resCatalogos.data || {};
      } catch (errCombined) {
        if (!errCombined.response) {
          throw errCombined;
        }
        const [centrosRes, sectoresRes, almacenesRes] = await Promise.all([
          api.get('/catalogos/centros'),
          api.get('/catalogos/sectores'),
          api.get('/catalogos/almacenes'),
        ]);
        catalogosData = {
          centros: centrosRes.data || [],
          sectores: sectoresRes.data || [],
          almacenes: almacenesRes.data || [],
        };
      }

      const acceso = await api.get('/auth/mi-acceso', { headers: authHeaders });
      const vista = acceso.data || {};
      const centrosPermitidos = vista.centros_permitidos || [];
      const sectoresPermitidos = vista.sectores_permitidos || [];
      const almacenesPermitidos = vista.almacenes_permitidos || [];

      const hasAccessControlCentros = Array.isArray(centrosPermitidos) && centrosPermitidos.length > 0;
      const hasAccessControlSectores = Array.isArray(sectoresPermitidos) && sectoresPermitidos.length > 0;
      const hasAccessControlAlmacenes = Array.isArray(almacenesPermitidos) && almacenesPermitidos.length > 0;

      const centrosFiltrados = (catalogosData.centros || []).filter(
        (c) => !hasAccessControlCentros || centrosPermitidos.includes(c.id)
      );
      const sectoresFiltrados = (catalogosData.sectores || []).filter(
        (s) => !hasAccessControlSectores || sectoresPermitidos.includes(s.id)
      );
      const almacenesFiltrados = (catalogosData.almacenes || []).filter(
        (a) => !hasAccessControlAlmacenes || almacenesPermitidos.includes(a.id)
      );

      setCatalogos({
        centros: centrosFiltrados,
        sectores: sectoresFiltrados,
        almacenes: almacenesFiltrados,
      });
    } catch (err) {
      setError('Error al cargar catalogos. Intenta recargar la pagina o reintenta en unos segundos.');
    } finally {
      setLoadingCatalogos(false);
    }
  };

  const preloadUserDataForNuevaSolicitud = async () => {
    try {
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.get('/auth/me', { headers: authHeaders });
      const currentUser = res.data?.user || {};

      setForm((prev) => {
        const next = { ...prev };
        if (currentUser.sector_id && catalogos.sectores.some((s) => s.id === currentUser.sector_id)) {
          next.sector = currentUser.sector_id;
        }
        if (currentUser.centro_id && catalogos.centros.some((c) => c.id === currentUser.centro_id)) {
          next.centro = currentUser.centro_id;
        }
        return next;
      });
    } catch (err) {
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadFormCatalogsForNuevaSolicitud();
      await preloadUserDataForNuevaSolicitud();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const onSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    // Validar fecha_necesidad >= hoy
    const today = new Date().toISOString().slice(0, 10);
    if (form.fecha_necesidad && form.fecha_necesidad < today) {
      setError(t('create_fecha_pasada', 'La fecha de necesidad no puede ser anterior a hoy'));
      return;
    }

    setSubmitting(true);
    try {
      let res;

      if (form.archivos && form.archivos.length > 0) {
        const formData = new FormData();
        formData.append('centro', form.centro);
        formData.append('sector', form.sector);
        formData.append('centro_costos', form.centro_costos);
        formData.append('almacen_virtual', form.almacen_virtual);
        formData.append('criticidad', form.criticidad);
        formData.append('fecha_necesidad', form.fecha_necesidad);
        formData.append('justificacion', form.justificacion);
        formData.append('usuario_id', user?.id || '');

        form.archivos.forEach((file) => {
          formData.append('archivos', file);
        });

        res = await solicitudes.crearConArchivos(formData);
      } else {
        const payload = {
          centro: form.centro,
          sector: form.sector,
          centro_costos: form.centro_costos,
          almacen_virtual: form.almacen_virtual,
          criticidad: form.criticidad,
          fecha_necesidad: form.fecha_necesidad,
          justificacion: form.justificacion,
          usuario_id: user?.id,
        };
        res = await solicitudes.crear(payload);
      }

      const data = res.data;
      const id = data.id || data.solicitud?.id;
      if (!id) throw new Error(t('create_no_id', 'No se recibió id de solicitud'));
      navigate(`/solicitudes/${id}/materiales`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, user?.id, navigate, t]);

  const handleCancel = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - form.archivos.length);
    if (files.length > 0) {
      setForm(prev => ({ ...prev, archivos: [...prev.archivos, ...files].slice(0, 5) }));
    }
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setForm(prev => ({
      ...prev,
      archivos: prev.archivos.filter((_, i) => i !== idx)
    }));
  };

  // Loading skeleton
  if (loadingCatalogos) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }} aria-busy="true" aria-label={t('create_loading', 'Cargando formulario de solicitud')}>
        <Box sx={{ maxWidth: 1024, mx: 'auto' }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box>
              <Skeleton variant="text" width={200} height={32} />
              <Skeleton variant="text" width={300} height={20} />
            </Box>
          </Stack>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Box sx={{ p: 3 }}>
              <Skeleton variant="text" width={150} height={24} sx={{ mb: 2 }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
                <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
                <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
              </Stack>
            </Box>
            <Divider />
            <Box sx={{ p: 3 }}>
              <Skeleton variant="text" width={150} height={24} sx={{ mb: 2 }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
                <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
                <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
              </Stack>
            </Box>
          </Paper>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 1024, mx: 'auto', px: 3, py: 3 }}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <IconButton
            onClick={() => navigate(-1)}
            aria-label={t('common_volver', 'Volver')}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'background.paper',
                borderColor: 'divider',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('create_title', 'Crear nueva solicitud')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('create_subtitle', 'Ingresa los datos de la solicitud de materiales')}
            </Typography>
          </Box>
        </Stack>

        {/* Error Alert */}
        <Box aria-live="polite">
          {error && (
            <Alert
              severity="error"
              onClose={() => setError('')}
              sx={{ mb: 3 }}
            >
              {error}
            </Alert>
          )}
        </Box>

        {/* Form Card */}
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <Box component="form" onSubmit={onSubmit} aria-label={t('create_form_label', 'Formulario de nueva solicitud')}>
            {/* Section 1: Location */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography
                variant="overline"
                component="h2"
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
              >
                {t('create_section_ubicacion', 'Datos de ubicación')}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>{t('create_centro', 'Centro')}</InputLabel>
                  <Select
                    name="centro"
                    value={form.centro}
                    onChange={onChange}
                    label={t('create_centro', 'Centro')}
                  >
                    <MenuItem value="">
                      <em>{t('create_select_centro', 'Selecciona un centro')}</em>
                    </MenuItem>
                    {catalogos.centros.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.id} - {c.nombre || c.descripcion || ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small" required>
                  <InputLabel>{t('create_sector', 'Sector')}</InputLabel>
                  <Select
                    name="sector"
                    value={form.sector}
                    onChange={onChange}
                    label={t('create_sector', 'Sector')}
                  >
                    <MenuItem value="">
                      <em>{t('create_select_sector', 'Selecciona un sector')}</em>
                    </MenuItem>
                    {catalogos.sectores.map((s) => (
                      <MenuItem key={s.nombre} value={s.nombre}>
                        {s.nombre || s.descripcion || ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small" required>
                  <InputLabel>{t('create_almacen', 'Almacén')}</InputLabel>
                  <Select
                    name="almacen_virtual"
                    value={form.almacen_virtual}
                    onChange={onChange}
                    label={t('create_almacen', 'Almacén')}
                  >
                    <MenuItem value="">
                      <em>{t('create_select_almacen', 'Selecciona un almacén')}</em>
                    </MenuItem>
                    {catalogos.almacenes.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.id} - {a.nombre || a.descripcion || ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            {/* Section 2: Details */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography
                variant="overline"
                component="h2"
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
              >
                {t('create_section_detalles', 'Detalles de la solicitud')}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('create_centro_costos', 'Centro de costos')}
                  name="centro_costos"
                  value={form.centro_costos}
                  onChange={onChange}
                  required
                  placeholder="Ej: CC001"
                />

                <FormControl fullWidth size="small">
                  <InputLabel>{t('create_criticidad', 'Criticidad')}</InputLabel>
                  <Select
                    name="criticidad"
                    value={form.criticidad}
                    onChange={onChange}
                    label={t('create_criticidad', 'Criticidad')}
                  >
                    <MenuItem value="Normal">{t('create_normal', 'Normal')}</MenuItem>
                    <MenuItem value="Alta">{t('create_alta', 'Alta')}</MenuItem>
                    <MenuItem value="Critica">{t('create_critica', 'Crítica')}</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t('create_fecha', 'Fecha de necesidad')}
                  name="fecha_necesidad"
                  value={form.fecha_necesidad}
                  onChange={onChange}
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              {form.criticidad !== 'Normal' && (
                <Alert
                  severity={form.criticidad === 'Critica' ? 'error' : 'warning'}
                  sx={{ mt: 2 }}
                >
                  {form.criticidad === 'Critica'
                    ? 'Las solicitudes críticas tienen prioridad máxima y serán notificadas inmediatamente.'
                    : 'Las solicitudes de alta prioridad serán procesadas con preferencia.'}
                </Alert>
              )}
            </Box>

            {/* Section 3: Additional Info */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography
                variant="overline"
                component="h2"
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
              >
                {t('create_section_adicional', 'Información adicional')}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                {/* Justification - 2/3 width */}
                <Box sx={{ flex: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={5}
                    label={t('create_justificacion', 'Justificación')}
                    name="justificacion"
                    value={form.justificacion}
                    onChange={onChange}
                    required
                    placeholder={t('create_justificacion_placeholder', 'Describe brevemente el motivo de la solicitud...')}
                  />
                </Box>

                {/* File Upload - 1/3 width */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {t('create_archivos', 'Archivos adjuntos')}
                  </Typography>
                  <Box
                    component="label"
                    htmlFor="file-upload"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 130,
                      border: 2,
                      borderStyle: 'dashed',
                      borderColor: form.archivos.length > 0 ? 'primary.main' : 'divider',
                      bgcolor: form.archivos.length > 0 ? 'primary.50' : 'background.default',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      hidden
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      aria-label={t('create_archivos', 'Archivos adjuntos')}
                    />

                    {form.archivos.length === 0 ? (
                      <>
                        <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary" fontWeight={500}>
                          {t('create_dropzone_text', 'Arrastra archivos o haz clic')}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
                          {t('create_dropzone_hint', 'Máx. 5 archivos (PDF, DOC, XLS, IMG)')}
                        </Typography>
                      </>
                    ) : (
                      <Box sx={{ width: '100%', px: 1, py: 0.5, maxHeight: 120, overflow: 'auto' }}>
                        {form.archivos.map((file, idx) => (
                          <Chip
                            key={idx}
                            icon={<InsertDriveFileIcon />}
                            label={file.name}
                            onDelete={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            deleteIcon={<CloseIcon />}
                            size="small"
                            sx={{ mb: 0.5, mr: 0.5, maxWidth: '100%' }}
                          />
                        ))}
                        {form.archivos.length < 5 && (
                          <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                            + {t('create_add_more', 'Agregar más')}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Stack>
            </Box>

            {/* Actions */}
            <Box
              sx={{
                px: 3,
                py: 2,
                bgcolor: 'grey.50',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={handleCancel}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              >
                {submitting
                  ? t('create_submitting', 'Creando...')
                  : t('create_btn', 'Crear y agregar materiales')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
