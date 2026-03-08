/**
 * Complete Registration - User registration completion form
 *
 * Features:
 * - Form for completing user registration
 * - Sector, Centro, Almacen selection
 * - Manager hierarchy definition
 * - Submit for admin approval
 *
 * Migrated to Material UI (MUI)
 */

import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Stack,
  Grid,
  MenuItem,
  Alert,
  CircularProgress
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useI18n } from "../context/i18n";
import api from "../services/api";

export default function CompleteRegistration() {
  const { t } = useI18n();
  const [form, setForm] = useState({
    sector: "",
    centro: "",
    almacen: "",
    jefe: "",
    gerente1: "",
    gerente2: "",
  });
  const [status, setStatus] = useState(null);
  const [catalogos, setCatalogos] = useState({ sectores: [], centros: [], almacenes: [] });

  useEffect(() => {
    let cancelled = false;
    const loadCatalogos = async () => {
      try {
        const res = await api.get("/catalogos");
        if (cancelled) return;
        setCatalogos({
          sectores: res.data?.sectores || [],
          centros: res.data?.centros || [],
          almacenes: res.data?.almacenes || [],
        });
      } catch {
        // Silenciar - se mostrarán listas vacías
      }
    };
    loadCatalogos();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("pending");
    // Aquí se enviaría al backend para aprobación del administrador
    setTimeout(() => setStatus("sent"), 800);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Page Header */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
          {t("registro_titulo", "Completar Registro")}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t("registro_desc", "Completa los campos requeridos; el administrador validara la informacion antes de habilitar el acceso total.")}
        </Typography>
      </Box>

      {/* Form Card */}
      <Paper
        elevation={1}
        sx={{
          p: 3,
          bgcolor: 'background.paper'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: 'text.primary' }}>
          {t("registro_datos_aprobacion", "Datos para aprobacion")}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Sector */}
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label={t("registro_sector_label", "Sector")}
                name="sector"
                value={form.sector}
                onChange={handleChange}
                required
                size="small"
              >
                <MenuItem value="">
                  <em>{t("registro_selecciona_sector", "Selecciona sector")}</em>
                </MenuItem>
                {catalogos.sectores.map((s) => (
                  <MenuItem key={s.id || s.nombre || s} value={s.nombre || s}>
                    {s.nombre || s}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Centro */}
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label={t("registro_centro_label", "Centro")}
                name="centro"
                value={form.centro}
                onChange={handleChange}
                required
                size="small"
              >
                <MenuItem value="">
                  <em>{t("registro_selecciona_centro", "Selecciona centro")}</em>
                </MenuItem>
                {catalogos.centros.map((c) => (
                  <MenuItem key={c.id || c.nombre || c} value={c.nombre || c}>
                    {c.nombre || c}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Almacén */}
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label={t("registro_almacen_label", "Almacen")}
                name="almacen"
                value={form.almacen}
                onChange={handleChange}
                required
                size="small"
              >
                <MenuItem value="">
                  <em>{t("registro_selecciona_almacen", "Selecciona almacen")}</em>
                </MenuItem>
                {catalogos.almacenes.map((a) => (
                  <MenuItem key={a.id || a.nombre || a} value={a.nombre || a}>
                    {a.nombre || a}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Jefe */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t("registro_jefe_label", "Jefe")}
                name="jefe"
                value={form.jefe}
                onChange={handleChange}
                placeholder={t("registro_nombre_apellido", "Nombre y apellido")}
                required
                size="small"
              />
            </Grid>

            {/* Gerente 1 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t("registro_gerente1_label", "Gerente 1")}
                name="gerente1"
                value={form.gerente1}
                onChange={handleChange}
                placeholder={t("registro_nombre_apellido", "Nombre y apellido")}
                required
                size="small"
              />
            </Grid>

            {/* Gerente 2 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t("registro_gerente2_label", "Gerente 2")}
                name="gerente2"
                value={form.gerente2}
                onChange={handleChange}
                placeholder={t("registro_nombre_apellido_opcional", "Nombre y apellido (opcional)")}
                size="small"
              />
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <Stack direction="row" justifyContent="flex-end" sx={{ pt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={status === "pending"}
                  startIcon={status === "pending" ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  {status === "pending" ? t("registro_enviando", "Enviando...") : t("registro_enviar_btn", "Enviar para aprobacion")}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Success Alert */}
      {status === "sent" && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
        >
          {t("registro_exito", "Solicitud enviada. Un administrador revisara y aprobara tu alta.")}
        </Alert>
      )}
    </Box>
  );
}
