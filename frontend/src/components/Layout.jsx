/**
 * Layout Component - Sidebar-based navigation
 * Glass Morphism Design (Apple/iOS Style)
 * Gradient background with glass effects
 *
 * Inicializa conexion de tiempo real (SSE) para notificaciones
 */

import React, { useEffect, useState } from "react";
import { MessageSquare, Wifi, WifiOff } from "./ui/Icons";
import clsx from "clsx";
import { useAuthStore } from "../store/authStore";
import { useVertexStore } from "../store/vertexStore";
import { useRealtime } from "../hooks/useRealtime";
import ChatAssistant from "./ChatAssistant";
import Sidebar from "./Sidebar";
import ToastContainer from "./ui/ToastContainer";
import { useI18n } from "../context/i18n";

export default function Layout({ children }) {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toggleChat, getUnshownAlertsCount } = useVertexStore();
  const unshownAlertsCount = getUnshownAlertsCount();

  // Inicializar conexion de tiempo real (SSE)
  // Solo se conecta si hay usuario autenticado
  const { isConnected, connectionError } = useRealtime({
    enabled: !!user
  });

  // Load sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("spm-sidebar-collapsed");
    if (saved !== null) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save sidebar state
  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("spm-sidebar-collapsed", JSON.stringify(newState));
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Sidebar - Pass real-time state */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        isConnected={isConnected}
      />

      {/* Main content area */}
      <div
        className={clsx(
          "min-h-screen transition-all duration-300 ease-spring",
          sidebarCollapsed ? "ml-14" : "ml-56"
        )}
      >
        {/* Page content - No header, full height */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Floating Chat Button - Vertex IA */}
      <button
        type="button"
        onClick={toggleChat}
        className={clsx(
          "fixed bottom-6 right-6 z-50",
          "h-14 w-14 rounded-full grid place-items-center",
          "bg-gradient-to-r from-violet-500 to-purple-600",
          "text-white shadow-lg shadow-violet-500/30",
          "hover:shadow-xl hover:shadow-violet-500/40",
          "hover:from-violet-600 hover:to-purple-700",
          "transition-all duration-300 ease-spring",
          "hover:scale-105"
        )}
        aria-label="Abrir Vertex IA"
        title={t("tooltip_chat", "Vertex IA - Asistente")}
      >
        {/* Avatar V */}
        <span className="text-lg font-bold">V</span>
        {/* Badge de alertas */}
        {unshownAlertsCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
            {unshownAlertsCount > 9 ? '9+' : unshownAlertsCount}
          </span>
        )}
      </button>

      {/* Chat Assistant */}
      <ChatAssistant />

      {/* Toast Container for notifications */}
      <ToastContainer />
    </div>
  );
}
