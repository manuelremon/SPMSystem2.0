/**
 * ToastContainer - Contenedor de notificaciones toast
 *
 * Renderiza toasts flotantes en la esquina inferior derecha
 * con auto-dismiss y animaciones.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtimeStore } from "../../store/realtimeStore";
import {
  Info,
  CheckCircle,
  AlertCircle,
  XCircle,
  X,
  FileText,
  Clock,
  MessageSquare
} from "./Icons";

// Mapeo de tipos a iconos y colores (con soporte dark mode)
const toastConfig = {
  info: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/40", border: "border-blue-200 dark:border-blue-700" },
  success: { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/40", border: "border-emerald-200 dark:border-emerald-700" },
  warning: { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/40", border: "border-amber-200 dark:border-amber-700" },
  error: { icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/40", border: "border-red-200 dark:border-red-700" },
  solicitud_created: { icon: FileText, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-900/40", border: "border-cyan-200 dark:border-cyan-700" },
  solicitud_approved: { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/40", border: "border-emerald-200 dark:border-emerald-700" },
  solicitud_rejected: { icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/40", border: "border-red-200 dark:border-red-700" },
  solicitud_planned: { icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/40", border: "border-amber-200 dark:border-amber-700" },
  mensaje_nuevo: { icon: MessageSquare, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/40", border: "border-indigo-200 dark:border-indigo-700" },
};

function getConfig(type) {
  return toastConfig[type] || toastConfig.info;
}

function Toast({ toast, onClose, onClick }) {
  const config = getConfig(toast.type);
  const IconComponent = config.icon;

  // Auto-dismiss
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm ${config.bg} ${config.border} cursor-pointer transform transition-all duration-300 ease-out animate-slide-in-right hover:scale-[1.02]`}
      onClick={() => onClick(toast)}
    >
      {/* Icono */}
      <div className="flex-shrink-0">
        <IconComponent className={`w-5 h-5 ${config.color}`} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
          {toast.message}
        </p>
        {toast.solicitudId && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Solicitud #{toast.solicitudId}
          </p>
        )}
      </div>

      {/* Boton cerrar */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(toast.id);
        }}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const navigate = useNavigate();
  const { toasts, removeToast } = useRealtimeStore();

  const handleToastClick = (toast) => {
    // Navegar segun el tipo
    if (toast.solicitudId) {
      navigate(`/solicitudes/${toast.solicitudId}`);
    } else if (toast.type === "mensaje_nuevo") {
      navigate("/mensajes");
    } else {
      navigate("/notificaciones");
    }
    removeToast(toast.id);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={removeToast}
          onClick={handleToastClick}
        />
      ))}
    </div>
  );
}
