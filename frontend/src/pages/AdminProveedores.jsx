import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useI18n } from "../context/i18n";
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { ArrowBack } from "@mui/icons-material";

const CALIFICACION_OPTIONS = [
  { value: "sin_calificar", label: "Sin calificar", color: "#64748b" },
  { value: "cumplidor", label: "Cumplidor", color: "#10b981" },
  { value: "muy_cumplidor", label: "Muy cumplidor", color: "#059669" },
  { value: "incumplidor", label: "Incumplidor", color: "#f59e0b" },
  { value: "muy_incumplidor", label: "Muy incumplidor", color: "#ef4444" },
];

const initialFormInterno = {
  centro: "",
  almacen: "",
  centro_nombre: "",
  almacen_nombre: "",
  sector: "",
  contacto_centro: "",
  responsable_centro: "",
  referente_nombre: "",
  referente_email: "",
  notas: "",
};

const initialFormExterno = {
  cuit: "",
  nombre: "",
  direccion: "",
  localidad: "",
  pais: "Argentina",
  origen: "local",
  lead_time_dias: 7,
  rubro: "",
  calificacion: "sin_calificar",
};

export default function AdminProveedores() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "externos" ? 1 : 0;
  const [tab, setTab] = useState(initialTab);

  // Internos state
  const [internos, setInternos] = useState([]);
  const [loadingInternos, setLoadingInternos] = useState(true);

  // Externos state
  const [externos, setExternos] = useState([]);
  const [loadingExternos, setLoadingExternos] = useState(true);

  // Common state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form dialogs
  const [showFormInterno, setShowFormInterno] = useState(false);
  const [showFormExterno, setShowFormExterno] = useState(false);
  const [editingInterno, setEditingInterno] = useState(null);
  const [editingExterno, setEditingExterno] = useState(null);
  const [formInterno, setFormInterno] = useState(initialFormInterno);
  const [formExterno, setFormExterno] = useState(initialFormExterno);

  // Delete dialogs
  const [deleteDialogInterno, setDeleteDialogInterno] = useState({ open: false, item: null });
  const [deleteDialogExterno, setDeleteDialogExterno] = useState({ open: false, item: null });

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "externos") setTab(1);
    else if (tabParam === "internos") setTab(0);
  }, [searchParams]);

  // Load internos
  const loadInternos = useCallback(async () => {
    setLoadingInternos(true);
    try {
      const res = await api.get("/admin/proveedores/internos");
      const data = (res.data || []).map(r => ({ ...r, _id: `${r.centro}_${r.almacen}` }));
      setInternos(data);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoadingInternos(false);
    }
  }, []);

  // Load externos
  const loadExternos = useCallback(async () => {
    setLoadingExternos(true);
    try {
      const res = await api.get("/admin/proveedores/externos");
      setExternos(res.data || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoadingExternos(false);
    }
  }, []);

  useEffect(() => {
    loadInternos();
    loadExternos();
  }, [loadInternos, loadExternos]);

  // Columns for internos (AG Grid format)
  const columnDefsInternos = useMemo(() => [
    { field: "centro", headerName: t('admin_prov_centro', 'Centro'), flex: 0.4, minWidth: 80 },
    { field: "centro_nombre", headerName: t('admin_prov_nombre_centro', 'Nombre Centro'), flex: 1, minWidth: 150 },
    { field: "almacen", headerName: t('admin_prov_almacen', 'Almacén'), flex: 0.4, minWidth: 80 },
    { field: "almacen_nombre", headerName: t('admin_prov_nombre_almacen', 'Nombre Almacén'), flex: 1, minWidth: 150 },
    { field: "sector", headerName: t('admin_prov_sector', 'Sector'), flex: 0.6, minWidth: 100 },
    { field: "responsable_centro", headerName: t('admin_prov_responsable', 'Responsable'), flex: 0.8, minWidth: 120 },
    { field: "contacto_centro", headerName: t('admin_prov_contacto', 'Contacto'), flex: 1, minWidth: 150 },
    {
      field: "activo",
      headerName: t('admin_prov_estado', 'Estado'),
      flex: 0.5,
      minWidth: 80,
      cellRenderer: (params) => (
        <Typography
          variant="caption"
          sx={{
            color: params.value ? "#1b5e20" : "#b71c1c",
            fontWeight: 600,
            textTransform: "uppercase",
            fontSize: "11px",
          }}
        >
          {params.value ? t('admin_prov_activo', 'Activo') : t('admin_prov_inactivo', 'Inactivo')}
        </Typography>
      ),
    },
    {
      field: "acciones",
      headerName: t('admin_prov_acciones', 'Acciones'),
      flex: 0.6,
      minWidth: 150,
      sortable: false,
      cellRenderer: (params) => (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "center", height: "100%", width: "100%" }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleEditInterno(params.data)}
            sx={{ minWidth: 60, textTransform: "uppercase", fontSize: "11px" }}
          >
            {t('admin_prov_editar', 'Editar')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => setDeleteDialogInterno({ open: true, item: params.data })}
            sx={{ minWidth: 60, textTransform: "uppercase", fontSize: "11px" }}
          >
            {t('admin_prov_eliminar', 'Eliminar')}
          </Button>
        </Box>
      ),
    },
  ], [t]);

  // Columns for externos (AG Grid format)
  const columnDefsExternos = useMemo(() => [
    { field: "cuit", headerName: t('admin_prov_cuit', 'CUIT'), flex: 0.6, minWidth: 120 },
    { field: "nombre", headerName: t('admin_prov_nombre', 'Nombre'), flex: 1, minWidth: 180 },
    { field: "localidad", headerName: t('admin_prov_localidad', 'Localidad'), flex: 0.8, minWidth: 120 },
    { field: "rubro", headerName: t('admin_prov_rubro', 'Rubro'), flex: 0.8, minWidth: 120 },
    {
      field: "lead_time_dias",
      headerName: t('admin_prov_lead_time', 'Lead Time'),
      flex: 0.5,
      minWidth: 100,
      valueFormatter: (params) => `${params.value || 0} días`,
    },
    {
      field: "calificacion",
      headerName: t('admin_prov_calificacion', 'Calificación'),
      flex: 0.7,
      minWidth: 130,
      cellRenderer: (params) => {
        const opt = CALIFICACION_OPTIONS.find(o => o.value === params.value) || CALIFICACION_OPTIONS[0];
        return (
          <Typography
            variant="caption"
            sx={{
              color: opt.color,
              fontWeight: 600,
              textTransform: "uppercase",
              fontSize: "11px",
            }}
          >
            {opt.label}
          </Typography>
        );
      },
    },
    {
      field: "activo",
      headerName: t('admin_prov_estado', 'Estado'),
      flex: 0.5,
      minWidth: 80,
      cellRenderer: (params) => (
        <Typography
          variant="caption"
          sx={{
            color: params.value ? "#1b5e20" : "#b71c1c",
            fontWeight: 600,
            textTransform: "uppercase",
            fontSize: "11px",
          }}
        >
          {params.value ? t('admin_prov_activo', 'Activo') : t('admin_prov_inactivo', 'Inactivo')}
        </Typography>
      ),
    },
    {
      field: "acciones",
      headerName: t('admin_prov_acciones', 'Acciones'),
      flex: 0.6,
      minWidth: 150,
      sortable: false,
      cellRenderer: (params) => (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "center", height: "100%", width: "100%" }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleEditExterno(params.data)}
            sx={{ minWidth: 60, textTransform: "uppercase", fontSize: "11px" }}
          >
            {t('admin_prov_editar', 'Editar')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => setDeleteDialogExterno({ open: true, item: params.data })}
            sx={{ minWidth: 60, textTransform: "uppercase", fontSize: "11px" }}
          >
            {t('admin_prov_eliminar', 'Eliminar')}
          </Button>
        </Box>
      ),
    },
  ], [t]);

  // Handlers Internos
  const handleEditInterno = useCallback((row) => {
    setEditingInterno(`${row.centro}_${row.almacen}`);
    setFormInterno({
      centro: row.centro || "",
      almacen: row.almacen || "",
      centro_nombre: row.centro_nombre || "",
      almacen_nombre: row.almacen_nombre || "",
      sector: row.sector || "",
      contacto_centro: row.contacto_centro || "",
      responsable_centro: row.responsable_centro || "",
      referente_nombre: row.referente_nombre || "",
      referente_email: row.referente_email || "",
      notas: row.notas || "",
    });
    setShowFormInterno(true);
    setError("");
    setSuccess("");
  }, []);

  const handleNewInterno = useCallback(() => {
    setEditingInterno(null);
    setFormInterno(initialFormInterno);
    setShowFormInterno(true);
    setError("");
    setSuccess("");
  }, []);

  const handleSubmitInterno = useCallback(async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formInterno.centro || !formInterno.almacen) {
      setError("Centro y Almacén son requeridos");
      return;
    }

    setSubmitting(true);
    try {
      if (editingInterno) {
        const [centro, almacen] = editingInterno.split("_");
        await api.put(`/admin/proveedores/internos/${centro}/${almacen}`, formInterno);
        setSuccess("Proveedor interno actualizado correctamente");
      } else {
        await api.post("/admin/proveedores/internos", formInterno);
        setSuccess("Proveedor interno creado correctamente");
      }

      setShowFormInterno(false);
      setFormInterno(initialFormInterno);
      setEditingInterno(null);
      await loadInternos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [formInterno, editingInterno, loadInternos]);

  const handleDeleteInterno = useCallback(async () => {
    if (!deleteDialogInterno.item) return;
    setSubmitting(true);
    try {
      const { centro, almacen } = deleteDialogInterno.item;
      await api.delete(`/admin/proveedores/internos/${centro}/${almacen}`);
      setSuccess("Proveedor interno eliminado correctamente");
      setDeleteDialogInterno({ open: false, item: null });
      await loadInternos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [deleteDialogInterno.item, loadInternos]);

  // Handlers Externos
  const handleEditExterno = useCallback((row) => {
    setEditingExterno(row.cuit);
    setFormExterno({
      cuit: row.cuit || "",
      nombre: row.nombre || "",
      direccion: row.direccion || "",
      localidad: row.localidad || "",
      pais: row.pais || "Argentina",
      origen: row.origen || "local",
      lead_time_dias: row.lead_time_dias || 7,
      rubro: row.rubro || "",
      calificacion: row.calificacion || "sin_calificar",
    });
    setShowFormExterno(true);
    setError("");
    setSuccess("");
  }, []);

  const handleNewExterno = useCallback(() => {
    setEditingExterno(null);
    setFormExterno(initialFormExterno);
    setShowFormExterno(true);
    setError("");
    setSuccess("");
  }, []);

  const handleSubmitExterno = useCallback(async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formExterno.cuit || !formExterno.nombre) {
      setError("CUIT y Nombre son requeridos");
      return;
    }

    setSubmitting(true);
    try {
      if (editingExterno) {
        await api.put(`/admin/proveedores/externos/${encodeURIComponent(editingExterno)}`, formExterno);
        setSuccess("Proveedor externo actualizado correctamente");
      } else {
        await api.post("/admin/proveedores/externos", formExterno);
        setSuccess("Proveedor externo creado correctamente");
      }

      setShowFormExterno(false);
      setFormExterno(initialFormExterno);
      setEditingExterno(null);
      await loadExternos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [formExterno, editingExterno, loadExternos]);

  const handleDeleteExterno = useCallback(async () => {
    if (!deleteDialogExterno.item) return;
    setSubmitting(true);
    try {
      await api.delete(`/admin/proveedores/externos/${encodeURIComponent(deleteDialogExterno.item.cuit)}`);
      setSuccess("Proveedor externo eliminado correctamente");
      setDeleteDialogExterno({ open: false, item: null });
      await loadExternos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [deleteDialogExterno.item, loadExternos]);


  return (
    <Container maxWidth={false} sx={{ py: 2, maxWidth: 1600 }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton onClick={() => navigate("/admin")} size="small" sx={{ color: "text.secondary" }}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('admin_prov_title', 'Proveedores')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={tab === 0 ? handleNewInterno : handleNewExterno}
            sx={{ textTransform: "uppercase" }}
          >
            {t('admin_prov_nuevo', 'Nuevo')}
          </Button>
        </Box>
      </Box>

      {/* Alertas */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}>
          <Tab label={t('admin_prov_tab_internos', 'Internos (Almacenes)')} sx={{ textTransform: "uppercase", fontWeight: 600 }} />
          <Tab label={t('admin_prov_tab_externos', 'Externos')} sx={{ textTransform: "uppercase", fontWeight: 600 }} />
        </Tabs>
      </Box>

      {/* AG Grid Internos */}
      {tab === 0 && (
        <Paper elevation={2}>
          <SPMAgGrid
            rowData={internos}
            columnDefs={columnDefsInternos}
            getRowId={(params) => params.data._id}
            loading={loadingInternos}
            height={600}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[20, 50, 100]}
            rowHeight={67}
            enableQuickFilter={true}
            exportFileName="proveedores_internos"
          />
        </Paper>
      )}

      {/* AG Grid Externos */}
      {tab === 1 && (
        <Paper elevation={2}>
          <SPMAgGrid
            rowData={externos}
            columnDefs={columnDefsExternos}
            getRowId={(params) => params.data.cuit}
            loading={loadingExternos}
            height={600}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[20, 50, 100]}
            rowHeight={67}
            enableQuickFilter={true}
            exportFileName="proveedores_externos"
          />
        </Paper>
      )}

      {/* Modal Formulario Interno */}
      <Dialog open={showFormInterno} onClose={() => setShowFormInterno(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
          {editingInterno ? t('admin_prov_editar_interno', 'Editar Proveedor Interno') : t('admin_prov_nuevo_interno', 'Nuevo Proveedor Interno')}
        </DialogTitle>
        <form onSubmit={handleSubmitInterno}>
          <DialogContent dividers>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="centro"
                  label={t('admin_prov_centro', 'Centro')}
                  value={formInterno.centro}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, centro: e.target.value }))}
                  required
                  disabled={!!editingInterno}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="almacen"
                  label={t('admin_prov_almacen', 'Almacén')}
                  value={formInterno.almacen}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, almacen: e.target.value }))}
                  required
                  disabled={!!editingInterno}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="centro_nombre"
                  label={t('admin_prov_nombre_centro', 'Nombre Centro')}
                  value={formInterno.centro_nombre}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, centro_nombre: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="almacen_nombre"
                  label={t('admin_prov_nombre_almacen', 'Nombre Almacén')}
                  value={formInterno.almacen_nombre}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, almacen_nombre: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="sector"
                  label={t('admin_prov_sector', 'Sector')}
                  value={formInterno.sector}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, sector: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="responsable_centro"
                  label={t('admin_prov_responsable_deposito', 'Responsable Depósito')}
                  value={formInterno.responsable_centro}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, responsable_centro: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="contacto_centro"
                  label={t('admin_prov_contacto_centro', 'Contacto Centro')}
                  type="email"
                  value={formInterno.contacto_centro}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, contacto_centro: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="referente_nombre"
                  label={t('admin_prov_referente_nombre', 'Referente Nombre')}
                  value={formInterno.referente_nombre}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, referente_nombre: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="referente_email"
                  label={t('admin_prov_referente_email', 'Referente Email')}
                  type="email"
                  value={formInterno.referente_email}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, referente_email: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="notas"
                  label={t('admin_prov_notas', 'Notas')}
                  value={formInterno.notas}
                  onChange={(e) => setFormInterno(prev => ({ ...prev, notas: e.target.value }))}
                  multiline
                  rows={2}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button variant="outlined" color="inherit" onClick={() => setShowFormInterno(false)} disabled={submitting} sx={{ textTransform: "uppercase", color: "text.secondary", borderColor: "divider" }}>
              {t('admin_prov_cancelar', 'Cancelar')}
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null} sx={{ textTransform: "uppercase" }}>
              {submitting ? t('admin_prov_guardando', 'Guardando...') : editingInterno ? t('admin_prov_actualizar', 'Actualizar') : t('admin_prov_crear', 'Crear')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Formulario Externo */}
      <Dialog open={showFormExterno} onClose={() => setShowFormExterno(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700 }}>
          {editingExterno ? t('admin_prov_editar_externo', 'Editar Proveedor Externo') : t('admin_prov_nuevo_externo', 'Nuevo Proveedor Externo')}
        </DialogTitle>
        <form onSubmit={handleSubmitExterno}>
          <DialogContent dividers>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="cuit"
                  label={t('admin_prov_cuit', 'CUIT')}
                  value={formExterno.cuit}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, cuit: e.target.value }))}
                  required
                  disabled={!!editingExterno}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="nombre"
                  label={t('admin_prov_nombre', 'Nombre')}
                  value={formExterno.nombre}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, nombre: e.target.value }))}
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="direccion"
                  label={t('admin_prov_direccion', 'Dirección')}
                  value={formExterno.direccion}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, direccion: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="localidad"
                  label={t('admin_prov_localidad', 'Localidad')}
                  value={formExterno.localidad}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, localidad: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="rubro"
                  label={t('admin_prov_rubro', 'Rubro')}
                  value={formExterno.rubro}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, rubro: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  name="origen"
                  label={t('admin_prov_origen', 'Origen')}
                  value={formExterno.origen}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, origen: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                >
                  <MenuItem value="local">{t('admin_prov_origen_local', 'Local')}</MenuItem>
                  <MenuItem value="importado">{t('admin_prov_origen_importado', 'Importado')}</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  name="lead_time_dias"
                  label={t('admin_prov_lead_time_label', 'Lead Time (días)')}
                  type="number"
                  value={formExterno.lead_time_dias}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, lead_time_dias: Number(e.target.value) }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  name="calificacion"
                  label={t('admin_prov_calificacion', 'Calificación')}
                  value={formExterno.calificacion}
                  onChange={(e) => setFormExterno(prev => ({ ...prev, calificacion: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                >
                  {CALIFICACION_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button variant="outlined" color="inherit" onClick={() => setShowFormExterno(false)} disabled={submitting} sx={{ textTransform: "uppercase", color: "text.secondary", borderColor: "divider" }}>
              {t('admin_prov_cancelar', 'Cancelar')}
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null} sx={{ textTransform: "uppercase" }}>
              {submitting ? t('admin_prov_guardando', 'Guardando...') : editingExterno ? t('admin_prov_actualizar', 'Actualizar') : t('admin_prov_crear', 'Crear')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Eliminar Interno */}
      <Dialog open={deleteDialogInterno.open} onClose={() => setDeleteDialogInterno({ open: false, item: null })}>
        <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700, color: "error.main" }}>{t('admin_prov_eliminar', 'Eliminar')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('admin_prov_confirmar_eliminar_interno', '¿Eliminar el proveedor interno')} <strong>{deleteDialogInterno.item?.centro_nombre || deleteDialogInterno.item?.centro}</strong> - <strong>{deleteDialogInterno.item?.almacen_nombre || deleteDialogInterno.item?.almacen}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" color="inherit" onClick={() => setDeleteDialogInterno({ open: false, item: null })} disabled={submitting} sx={{ textTransform: "uppercase", color: "text.secondary", borderColor: "divider" }}>
            {t('admin_prov_cancelar', 'Cancelar')}
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteInterno} disabled={submitting} startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null} sx={{ textTransform: "uppercase" }}>
            {submitting ? t('admin_prov_eliminando', 'Eliminando...') : t('admin_prov_eliminar', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Eliminar Externo */}
      <Dialog open={deleteDialogExterno.open} onClose={() => setDeleteDialogExterno({ open: false, item: null })}>
        <DialogTitle sx={{ textTransform: "uppercase", fontWeight: 700, color: "error.main" }}>{t('admin_prov_eliminar', 'Eliminar')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('admin_prov_confirmar_eliminar_externo', '¿Eliminar el proveedor externo')} <strong>{deleteDialogExterno.item?.nombre}</strong> ({deleteDialogExterno.item?.cuit})?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" color="inherit" onClick={() => setDeleteDialogExterno({ open: false, item: null })} disabled={submitting} sx={{ textTransform: "uppercase", color: "text.secondary", borderColor: "divider" }}>
            {t('admin_prov_cancelar', 'Cancelar')}
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteExterno} disabled={submitting} startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null} sx={{ textTransform: "uppercase" }}>
            {submitting ? t('admin_prov_eliminando', 'Eliminando...') : t('admin_prov_eliminar', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
