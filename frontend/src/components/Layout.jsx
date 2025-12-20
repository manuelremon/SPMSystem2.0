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
import { useChatStore } from "../store/chatStore";
import { useRealtime } from "../hooks/useRealtime";
import ChatAssistant from "./ChatAssistant";
import Sidebar from "./Sidebar";
import { useI18n } from "../context/i18n";

export default function Layout({ children }) {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toggleChat } = useChatStore();

  // Inicializar conexion de tiempo real (SSE)
  // Solo se conecta si hay usuario autenticado
  const { isConnected, connectionError, unreadCount } = useRealtime({
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-slate-100 to-pink-100 text-slate-800">
      {/* Sidebar - Pass real-time state */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        unreadCount={unreadCount}
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

      {/* Floating Chat Button - Bottom Right - Glass gradient style */}
      <button
        type="button"
        onClick={toggleChat}
        className={clsx(
          "fixed bottom-6 right-6 z-50",
          "h-14 w-14 rounded-full grid place-items-center",
          "bg-gradient-to-r from-blue-500 to-blue-600",
          "text-white shadow-lg shadow-blue-500/30",
          "hover:shadow-xl hover:shadow-blue-500/40",
          "hover:from-blue-600 hover:to-blue-700",
          "transition-all duration-300 ease-spring",
          "hover:scale-105"
        )}
        aria-label="Abrir chat"
        title={t("tooltip_chat", "Asistente SPM")}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Assistant */}
      <ChatAssistant />
    </div>
  );
}
