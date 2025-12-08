import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { fetchCsrfToken } from "../services/csrf";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useI18n } from "../context/i18n";
import { Mail, Lock, User, AlertCircle } from "lucide-react";
import logo from "../assets/spm-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, user } = useAuthStore();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [showRecover, setShowRecover] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [registerData, setRegisterData] = useState({ email: "", nombre: "", password: "" });
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchCsrfToken();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    clearError();

    if (!username.trim() || !password.trim()) {
      setLocalError(t("login_error_required", "Usuario y contraseña son requeridos"));
      return;
    }

    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err) {
      setLocalError(error || t("login_error_default", "Error en el login"));
    }
  };

  const handleRecover = (e) => {
    e.preventDefault();
    setFeedback(
      (t(
        "login_recover_info",
        "Si el correo {email} está registrado, enviaremos un enlace para restablecer la contraseña."
      ) || "").replace("{email}", recoverEmail)
    );
    setRecoverEmail("");
    setShowRecover(false);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setFeedback(t("login_feedback_sent", "Solicitud de registro enviada. Completa tu perfil en el siguiente paso."));
    setShowRegister(false);
    navigate("/registro/completar");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="SPM" className="h-16 w-auto mx-auto mb-4 drop-shadow-lg" />
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            SPM <span className="text-sm font-normal text-slate-500 dark:text-slate-400">v2.0</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sistema de Planificación de Materiales
          </p>
        </div>

        {/* Login Card - Glass Morphism */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-2xl shadow-glass p-6">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-6">
            {t("login_title", "Iniciar sesión")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message - Glass style */}
            {(localError || error) && (
              <div className="flex items-center gap-2 p-3 bg-red-50/70 dark:bg-red-900/30 backdrop-blur-sm border border-red-200/50 dark:border-red-500/30 rounded-xl text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{localError || error}</span>
              </div>
            )}

            {/* Email Field - Glass style */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                {t("login_user_label", "Correo electrónico")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 transition-all"
                  placeholder="usuario@empresa.com"
                />
              </div>
            </div>

            {/* Password Field - Glass style */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                {t("login_pass_label", "Contraseña")}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? t("login_loading", "Ingresando...") : t("login_submit", "Ingresar")}
            </Button>

            {/* Links */}
            <div className="flex items-center justify-between pt-2 text-sm">
              <button
                type="button"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                onClick={() => setShowRecover(true)}
              >
                {t("login_recover", "¿Olvidaste tu contraseña?")}
              </button>
              <button
                type="button"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                onClick={() => setShowRegister(true)}
              >
                {t("login_register", "Crear cuenta")}
              </button>
            </div>

            {feedback && (
              <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-900/30 backdrop-blur-sm border border-blue-200/50 dark:border-blue-500/30 rounded-xl px-3 py-2">
                {feedback}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          © 2025 SPM System. Todos los derechos reservados.
        </p>
      </div>

      {/* Recover Modal */}
      <Modal
        isOpen={showRecover}
        onClose={() => setShowRecover(false)}
        title={t("login_recover_title", "Recuperar contraseña")}
        size="sm"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t(
            "login_recover_desc",
            "Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña."
          )}
        </p>
        <form onSubmit={handleRecover} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              {t("login_email_label", "Correo electrónico")}
            </label>
            <input
              type="email"
              value={recoverEmail}
              onChange={(e) => setRecoverEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 transition-all"
              placeholder="correo@empresa.com"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowRecover(false)}>
              {t("login_cancel", "Cancelar")}
            </Button>
            <Button type="submit">
              {t("login_send_link", "Enviar")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Register Modal */}
      <Modal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        title={t("login_register_title", "Crear cuenta")}
        size="sm"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              {t("login_email_label", "Correo electrónico")}
            </label>
            <input
              type="email"
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              required
              className="w-full px-3 py-2.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 transition-all"
              placeholder="correo@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              {t("login_name", "Nombre completo")}
            </label>
            <input
              type="text"
              value={registerData.nombre}
              onChange={(e) => setRegisterData({ ...registerData, nombre: e.target.value })}
              required
              className="w-full px-3 py-2.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 transition-all"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              {t("login_pass_label", "Contraseña")}
            </label>
            <input
              type="password"
              value={registerData.password}
              onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              required
              className="w-full px-3 py-2.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowRegister(false)}>
              {t("login_cancel", "Cancelar")}
            </Button>
            <Button type="submit">
              {t("login_register", "Crear cuenta")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
