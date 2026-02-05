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

import React, { useState } from "react";
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

const sectoresEjemplo = ["Operaciones", "Logística", "Compras", "Mantenimiento"];
const centrosEjemplo = ["Centro A", "Centro B", "Centro C"];
const almacenesEjemplo = ["Almacén 1", "Almacén 2", "Almacén 3"];

export default function CompleteRegistration() {
  const [form, setForm] = useState({
    sector: "",
    centro: "",
    almacen: "",
    jefe: "",
    gerente1: "",
    gerente2: "",
  });
  const [status, setStatus] = useState(null);

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
          Completar Registro
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Completa los campos requeridos; el administrador validará la información antes de habilitar el acceso total.
        </Typography>
      </Box>

      {/* Form Card */}
      <Paper
        elevation={1}
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.paper'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: 'text.primary' }}>
          Datos para aprobación
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Sector */}
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Sector"
                name="sector"
                value={form.sector}
                onChange={handleChange}
                required
                size="small"
              >
                <MenuItem value="">
                  <em>Selecciona sector</em>
                </MenuItem>
                {sectoresEjemplo.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Centro */}
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Centro"
                name="centro"
                value={form.centro}
                onChange={handleChange}
                required
                size="small"
              >
                <MenuItem value="">
                  <em>Selecciona centro</em>
                </MenuItem>
                {centrosEjemplo.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Almacén */}
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Almacén"
                name="almacen"
                value={form.almacen}
                onChange={handleChange}
                required
                size="small"
              >
                <MenuItem value="">
                  <em>Selecciona almacén</em>
                </MenuItem>
                {almacenesEjemplo.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Jefe */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Jefe"
                name="jefe"
                value={form.jefe}
                onChange={handleChange}
                placeholder="Nombre y apellido"
                required
                size="small"
              />
            </Grid>

            {/* Gerente 1 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Gerente 1"
                name="gerente1"
                value={form.gerente1}
                onChange={handleChange}
                placeholder="Nombre y apellido"
                required
                size="small"
              />
            </Grid>

            {/* Gerente 2 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Gerente 2"
                name="gerente2"
                value={form.gerente2}
                onChange={handleChange}
                placeholder="Nombre y apellido (opcional)"
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
                  {status === "pending" ? "Enviando..." : "Enviar para aprobación"}
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
          sx={{ borderRadius: 2 }}
        >
          Solicitud enviada. Un administrador revisará y aprobará tu alta.
        </Alert>
      )}
    </Box>
  );
}
