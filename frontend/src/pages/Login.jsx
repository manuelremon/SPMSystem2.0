import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { fetchCsrfToken } from "../services/csrf";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import logo from "../assets/spm-logo.png";
import { useI18n } from "../context/i18n";
import { ArrowRight, Mail, Lock, User, X, Linkedin, Twitter, Phone, MapPin, MessageCircle } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, user } = useAuthStore();
  const { t } = useI18n();
  const [username, setUsername] = useState("admin@spm.com");
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--fg)] px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_rgba(255,107,53,0.08)_0%,_transparent_70%)]" />
        <div className="grid-lines opacity-20" />
      </div>

      {/* Logo Section */}
      <div className="relative flex flex-col items-center gap-3 mb-8 animate-fadeIn">
        <div className="h-16 w-16 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center overflow-hidden">
          <img src={logo} alt="SPM" className="h-12 w-12 object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black uppercase tracking-[0.3em] text-[var(--primary)] drop-shadow-[0_0_15px_rgba(255,107,53,0.6)] [text-shadow:_2px_2px_0_rgba(255,107,53,0.3)]">
            SPM
          </h1>
          <p className="text-sm font-bold text-amber-400 mt-1 tracking-wide">
            v2.0
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-sm animate-slideUp">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl text-[var(--fg-strong)]">
              {t("login_title", "Bienvenido")}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {(localError || error) && (
              <div className="flex items-center gap-3 bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] px-4 py-3 border border-[var(--status-danger-border)] rounded-xl animate-scaleIn">
                <X className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">{localError || error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
                {t("login_user_label", "Mail o ID SPM")}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)] outline-none transition-all duration-200"
                  placeholder="usuario@email.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
                {t("login_pass_label", "Contraseña")}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)] outline-none transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] text-[var(--on-primary)] font-medium rounded-xl shadow-glow hover:shadow-glow-strong transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span>{isLoading ? t("login_loading", "Ingresando...") : t("login_submit", "Ingresar")}</span>
              {!isLoading && (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>

            {/* Links */}
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-[var(--fg-muted)] hover:text-[var(--primary)] transition-colors duration-200"
                onClick={() => setShowRecover(true)}
              >
                {t("login_recover", "Recuperar Contraseña")}
              </button>
              <button
                type="button"
                className="text-[var(--fg-muted)] hover:text-[var(--primary)] transition-colors duration-200"
                onClick={() => setShowRegister(true)}
              >
                {t("login_register", "Registrarme")}
              </button>
            </div>

            {feedback && (
              <div className="text-sm text-[var(--fg)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 animate-scaleIn">
                {feedback}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Social Links */}
      <div className="relative mt-8 text-center animate-fadeIn">
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://linkedin.com"
            className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center text-[var(--fg-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all duration-200"
            target="_blank"
            rel="noreferrer"
            title="LinkedIn"
          >
            <Linkedin className="w-4 h-4" />
          </a>
          <a
            href="https://twitter.com"
            className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center text-[var(--fg-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all duration-200"
            target="_blank"
            rel="noreferrer"
            title="Twitter"
          >
            <Twitter className="w-4 h-4" />
          </a>
          <a
            href="https://wa.me/5492994673102"
            className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center text-[var(--fg-muted)] hover:text-green-500 hover:border-green-500 transition-all duration-200"
            target="_blank"
            rel="noreferrer"
            title="WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Footer - Developer Info */}
      <div className="absolute bottom-0 left-0 right-0 py-3 px-4 bg-[var(--bg)]/80 backdrop-blur-sm border-t border-[var(--border)]/30">
        <div className="flex items-center justify-center gap-3 text-[10px] text-[var(--fg-subtle)] font-mono flex-wrap">
          <span>&copy; 2025 SPM v2.0</span>
          <span className="text-[var(--border)]">|</span>
          <span>Desarrollado por Manuel Remón</span>
          <span className="text-[var(--border)]">|</span>
          <span className="flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            Neuquén, Patagonia, Argentina
          </span>
          <span className="text-[var(--border)]">|</span>
          <a href="tel:+5492994673102" className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors">
            <Phone className="w-2.5 h-2.5" />
            +54 9 299 467 3102
          </a>
          <span className="text-[var(--border)]">|</span>
          <a href="mailto:solicitudespuntualesmateriales@gmail.com" className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors">
            <Mail className="w-2.5 h-2.5" />
            solicitudespuntualesmateriales@gmail.com
          </a>
        </div>
      </div>

      {/* Recover Modal */}
      <Modal
        isOpen={showRecover}
        onClose={() => setShowRecover(false)}
        title={t("login_recover", "Recuperar Contraseña")}
        size="sm"
      >
        <p className="text-sm text-[var(--fg-muted)] mb-4">
          {t(
            "login_recover_desc",
            "Ingresa el correo con el que te registraste. Te enviaremos un enlace para generar una nueva contraseña."
          )}
        </p>
        <form onSubmit={handleRecover} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
              {t("login_email_label", "Correo electrónico")}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)] outline-none transition-all duration-200"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowRecover(false)}
            >
              {t("login_cancel", "Cancelar")}
            </Button>
            <Button type="submit">
              {t("login_send_link", "Enviar enlace")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Register Modal */}
      <Modal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        title={t("login_register_fast", "Registro")}
        size="sm"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
              {t("login_email_label", "Correo electrónico")}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
                className="w-full pl-11 pr-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)] outline-none transition-all duration-200"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
              {t("login_name", "Nombre")}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={registerData.nombre}
                onChange={(e) => setRegisterData({ ...registerData, nombre: e.target.value })}
                required
                className="w-full pl-11 pr-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)] outline-none transition-all duration-200"
                placeholder="Tu nombre"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
              {t("login_pass_label", "Contraseña")}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
                className="w-full pl-11 pr-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)] outline-none transition-all duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowRegister(false)}
            >
              {t("login_cancel", "Cancelar")}
            </Button>
            <Button type="submit">
              {t("login_register", "Registrarme")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
