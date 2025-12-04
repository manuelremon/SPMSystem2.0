import React, { useEffect, useRef, useCallback } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { Button } from "./Button";

/**
 * Modal Component - Professional modal dialog system
 *
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal should close
 * @param {string} title - Modal title
 * @param {ReactNode} children - Modal content
 * @param {string} size - Modal size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
 * @param {boolean} closeOnOverlayClick - Allow closing by clicking overlay (default: true)
 * @param {boolean} showCloseButton - Show X button in header (default: true)
 * @param {ReactNode} footer - Optional footer content
 * @param {string} className - Additional classes for modal content
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlayClick = true,
  showCloseButton = true,
  footer,
  className,
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Focus trap - get all focusable elements
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    return modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
  }, []);

  // Handle keyboard navigation for focus trap
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (e.key !== "Tab") return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: go to previous element
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: go to next element
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [onClose, getFocusableElements]);

  // Focus management on open/close
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element
      previousActiveElement.current = document.activeElement;

      // Focus the first focusable element in modal after a short delay
      const timer = setTimeout(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }, 50);

      return () => clearTimeout(timer);
    } else {
      // Restore focus to previous element when closing
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen, getFocusableElements]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-7xl",
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-strong animate-fade-in"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={clsx(
          "relative w-full bg-[var(--card)] rounded-2xl border border-[var(--border)] animate-scale-in",  /* Bento Grid: rounded-2xl, sin shadow */
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <h2 id="modal-title" className="text-xl font-semibold text-[var(--fg-strong)]">{title}</h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-150 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-4 border-t border-[var(--border)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ConfirmModal - Pre-configured modal for confirmations
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar",
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary",
}) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-[var(--fg)]">{message}</p>
    </Modal>
  );
}

/**
 * AlertModal - Pre-configured modal for alerts
 */
export function AlertModal({
  isOpen,
  onClose,
  title = "Aviso",
  message,
  buttonText = "Entendido",
  variant = "primary",
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <Button variant={variant} onClick={onClose}>
          {buttonText}
        </Button>
      }
    >
      <p className="text-[var(--fg)]">{message}</p>
    </Modal>
  );
}

export default Modal;
