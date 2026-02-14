import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { fetchCsrfToken } from "../services/csrf";
import { useI18n } from "../context/i18n";
import { useParallax } from "../hooks/useParallax";

// MUI Components
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CssBaseline from "@mui/material/CssBaseline";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";
import { useTheme } from "@mui/material/styles";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

// Google Icon Component
function GoogleIcon() {
  return (
    <SvgIcon>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M15.68 8.18182C15.68 7.61455 15.6291 7.06909 15.5345 6.54545H8V9.64364H12.3055C12.1164 10.64 11.5491 11.4836 10.6982 12.0509V14.0655H13.2945C14.8073 12.6691 15.68 10.6182 15.68 8.18182Z"
          fill="#4285F4"
        />
        <path
          d="M8 16C10.16 16 11.9709 15.2873 13.2945 14.0655L10.6982 12.0509C9.98545 12.5309 9.07636 12.8218 8 12.8218C5.92 12.8218 4.15273 11.4182 3.52 9.52727H0.858182V11.5927C2.17455 14.2036 4.87273 16 8 16Z"
          fill="#34A853"
        />
        <path
          d="M3.52 9.52C3.36 9.04 3.26545 8.53091 3.26545 8C3.26545 7.46909 3.36 6.96 3.52 6.48V4.41455H0.858182C0.312727 5.49091 0 6.70545 0 8C0 9.29455 0.312727 10.5091 0.858182 11.5855L2.93091 9.97091L3.52 9.52Z"
          fill="#FBBC05"
        />
        <path
          d="M8 3.18545C9.17818 3.18545 10.2255 3.59273 11.0618 4.37818L13.3527 2.08727C11.9636 0.792727 10.16 0 8 0C4.87273 0 2.17455 1.79636 0.858182 4.41455L3.52 6.48C4.15273 4.58909 5.92 3.18545 8 3.18545Z"
          fill="#EA4335"
        />
      </svg>
    </SvgIcon>
  );
}

// Forgot Password Dialog Component
function ForgotPasswordDialog({ open, handleClose, t }) {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setFeedback(
      t(
        "login_recover_info",
        "Si el correo está registrado, enviaremos un enlace para restablecer la contraseña."
      )
    );
    setTimeout(() => {
      setEmail("");
      setFeedback("");
      handleClose();
    }, 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          component: "form",
          onSubmit: handleSubmit,
          sx: { backgroundImage: "none" },
        },
      }}
    >
      <DialogTitle>{t("login_recover_title", "Recuperar contraseña")}</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
      >
        <DialogContentText>
          {t(
            "login_recover_desc",
            "Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña."
          )}
        </DialogContentText>
        {feedback && (
          <Alert severity="success" sx={{ mt: 1 }}>
            {feedback}
          </Alert>
        )}
        <OutlinedInput
          autoFocus
          required
          margin="dense"
          id="recover-email"
          name="email"
          placeholder={t("login_email_placeholder", "correo@empresa.com")}
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </DialogContent>
      <DialogActions sx={{ pb: 3, px: 3 }}>
        <Button onClick={handleClose}>{t("login_cancel", "Cancelar")}</Button>
        <Button variant="contained" type="submit">
          {t("login_send_link", "Enviar")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Register Dialog Component
function RegisterDialog({ open, handleClose, t, onRegister, isSubmitting, registerError }) {
  const [formData, setFormData] = useState({ email: "", nombre: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    onRegister(formData);
  };

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          component: "form",
          onSubmit: handleSubmit,
          sx: { backgroundImage: "none", minWidth: 400 },
        },
      }}
    >
      <DialogTitle>{t("login_register_title", "Crear cuenta")}</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
      >
        {registerError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {registerError}
          </Alert>
        )}
        <FormControl>
          <FormLabel htmlFor="register-email">
            {t("login_email_label", "Correo electrónico")}
          </FormLabel>
          <TextField
            id="register-email"
            type="email"
            name="email"
            placeholder={t("login_email_placeholder", "correo@empresa.com")}
            autoComplete="email"
            required
            fullWidth
            variant="outlined"
            size="small"
            value={formData.email}
            onChange={handleChange("email")}
          />
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="register-name">
            {t("login_name", "Nombre completo")}
          </FormLabel>
          <TextField
            id="register-name"
            type="text"
            name="nombre"
            placeholder="Juan Pérez"
            autoComplete="name"
            required
            fullWidth
            variant="outlined"
            size="small"
            value={formData.nombre}
            onChange={handleChange("nombre")}
          />
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="register-password">
            {t("login_pass_label", "Contraseña")}
          </FormLabel>
          <OutlinedInput
            id="register-password"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            fullWidth
            size="small"
            value={formData.password}
            onChange={handleChange("password")}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            }
          />
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ pb: 3, px: 3 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          {t("login_cancel", "Cancelar")}
        </Button>
        <Button variant="contained" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? t("register_loading", "Creando cuenta...")
            : t("login_register", "Crear cuenta")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Main Login Component
export default function Login() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { login, register, isLoading, error, clearError, user } = useAuthStore();
  const { t } = useI18n();

  const { ref: parallaxRef, style: parallaxStyle, isDisabled: parallaxDisabled } = useParallax({ offset: 0.7 });

  const [emailError, setEmailError] = useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [openForgotPassword, setOpenForgotPassword] = useState(false);
  const [openRegister, setOpenRegister] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState("");

  useEffect(() => {
    if (user) {
      if (user.is_new_user) {
        navigate("/nuevo-usuario");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchCsrfToken();
  }, []);

  const validateInputs = () => {
    const identifier = document.getElementById("email");
    const password = document.getElementById("password");
    let isValid = true;

    const isEmail = /\S+@\S+\.\S+/.test(identifier.value);
    const isNumericId = /^\d+$/.test(identifier.value);

    if (!identifier.value || (!isEmail && !isNumericId)) {
      setEmailError(true);
      setEmailErrorMessage(
        t("login_error_identifier", "Ingresa un correo electrónico o número de ID válido.")
      );
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage("");
    }

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage(
        t("login_error_password", "La contraseña debe tener al menos 6 caracteres.")
      );
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage("");
    }
    return isValid;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    if (!validateInputs()) return;

    const data = new FormData(event.currentTarget);
    const email = data.get("email");
    const password = data.get("password");

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setEmailError(true);
      setEmailErrorMessage(error || t("login_error_default", "Error en el login"));
    }
  };

  const handleRegister = async (formData) => {
    setRegisterError("");
    clearError();
    if (!formData.email || !formData.nombre || !formData.password) {
      setRegisterError(t("register_error_required", "Todos los campos son obligatorios"));
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await register(formData);
      setOpenRegister(false);
      if (response?.user?.is_new_user) {
        navigate("/nuevo-usuario");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message || t("register_error_default", "Error al crear la cuenta");
      setRegisterError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <CssBaseline enableColorScheme />
      <Box
        component={Stack}
        direction="column"
        sx={{
          minHeight: "100dvh",
          p: { xs: 2, sm: 4 },
          pb: '80px',
          bgcolor: 'background.default',
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
        }}
      >
        <Card
          ref={parallaxRef}
          variant="outlined"
          style={parallaxDisabled ? {} : parallaxStyle}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignSelf: "center",
            width: "100%",
            p: 4,
            gap: 2,
            m: "auto",
            maxWidth: { sm: "450px" },
            boxShadow: theme.shadows[3],
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius, // Use theme border radius
          }}
        >
          {/* Logo SPM */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 1 }}>
            <Typography
              component="h1"
              variant="h5"
              sx={{ fontWeight: 600, color: "text.primary" }}
            >
              SPM
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sistema de Planificación de Materiales
            </Typography>
          </Box>

          <Typography
            component="h2"
            variant="h4"
            sx={{ width: "100%", fontSize: "clamp(1.5rem, 8vw, 1.75rem)", textAlign: "center" }}
          >
            {t("login_title", "Iniciar sesión")}
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ width: "100%" }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: 2,
            }}
          >
            <FormControl>
              <FormLabel htmlFor="email">
                {t("login_user_label", "Correo o ID de empleado")}
              </FormLabel>
              <TextField
                error={emailError}
                helperText={emailErrorMessage}
                id="email"
                type="text"
                name="email"
                placeholder={t("login_identifier_placeholder", "correo@empresa.com o 12345")}
                autoComplete="username"
                autoFocus
                required
                fullWidth
                variant="outlined"
                color={emailError ? "error" : "primary"}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">
                {t("login_pass_label", "Contraseña")}
              </FormLabel>
              <OutlinedInput
                error={passwordError}
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="••••••"
                autoComplete="current-password"
                required
                fullWidth
                color={passwordError ? "error" : "primary"}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                }
              />
              {passwordError && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  {passwordErrorMessage}
                </Typography>
              )}
            </FormControl>
            <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label={t("login_remember", "Recordarme")}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
            >
              {isLoading
                ? t("login_loading", "Ingresando...")
                : t("login_submit", "Ingresar")}
            </Button>
            <Link
              component="button"
              type="button"
              onClick={() => setOpenForgotPassword(true)}
              variant="body2"
              sx={{ alignSelf: "center" }}
            >
              {t("login_recover", "¿Olvidaste tu contraseña?")}
            </Link>
          </Box>
          <Divider>{t("login_or", "o")}</Divider>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => { /* Google OAuth - pendiente de integración */ }}
              startIcon={<GoogleIcon />}
            >
              {t("login_google", "Iniciar sesión con Google")}
            </Button>
            <Typography sx={{ textAlign: "center" }}>
              {t("login_no_account", "¿No tienes una cuenta?")}{" "}
              <Link
                component="button"
                type="button"
                onClick={() => setOpenRegister(true)}
                variant="body2"
                sx={{ alignSelf: "center" }}
              >
                {t("login_register", "Crear cuenta")}
              </Link>
            </Typography>
          </Box>

          {/* Ayuda - Esquina inferior derecha */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
            <Link
              href="mailto:planifica-materiales@gmail.com?subject=Ayuda%20-%20SPM%20Sistema"
              variant="body2"
              sx={{ alignSelf: "flex-end" }}
            >
              {t("login_help", "Ayuda")}
            </Link>
          </Box>
        </Card>
      </Box>

      {/* Footer - Fijo al fondo */}
      <Box sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: "center",
        p: 2,
        bgcolor: 'background.default',
        color: 'text.secondary',
        fontSize: "0.75rem",
      }}>
        <Box>© 2025 Sistema SPM. Todos los derechos reservados.</Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mt: 0.5 }}>
          <span>Desarrollado por Manuel Remón - +54 9 299 467 3102 - Neuquén, Argentina</span>
          <Link
            href="https://wa.me/5492994673102"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: "inline-flex", alignItems: "center", ml: 0.5 }}
          >
            <SvgIcon sx={{ fontSize: 16, color: "#25D366" }}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </SvgIcon>
          </Link>
        </Box>
      </Box>

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        open={openForgotPassword}
        handleClose={() => setOpenForgotPassword(false)}
        t={t}
      />

      {/* Register Dialog */}
      <RegisterDialog
        open={openRegister}
        handleClose={() => setOpenRegister(false)}
        t={t}
        onRegister={handleRegister}
        isSubmitting={isSubmitting}
        registerError={registerError}
      />
    </>
  );
}
