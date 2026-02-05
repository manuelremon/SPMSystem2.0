/**
 * Drawer - Enterprise Design System
 * Clean slide-out panel with solid styling
 */

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "./Icons";

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "420px",
  position = "right",
}) {
  const drawerRef = useRef(null);
  const previousActiveElement = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";

      setTimeout(() => {
        drawerRef.current?.focus();
      }, 100);

      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";

      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const positionClasses = position === "right"
    ? "right-0 animate-slide-in-right"
    : "left-0 animate-slide-in-left";

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Overlay - solid, no blur */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ backgroundColor: "var(--overlay)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        className={`
          absolute top-0 bottom-0 ${positionClasses}
          flex flex-col
          shadow-xl
          outline-none
        `}
        style={{
          width,
          backgroundColor: "var(--card)",
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-6 py-4 border-b"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-soft)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="drawer-title"
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--fg-strong)" }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className="mt-0.5 text-xs truncate"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 -m-1.5 rounded transition-colors"
              style={{ color: "var(--fg-subtle)" }}
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex-shrink-0 px-6 py-4 border-t"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-soft)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Drawer;
