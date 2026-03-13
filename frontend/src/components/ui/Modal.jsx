import React, { useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Slide from "@mui/material/Slide";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { X } from "./Icons";

// Transición para el Dialog
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/**
 * Modal Component - MUI Dialog + Responsive
 * En móvil: Bottom Sheet (SwipeableDrawer)
 * En desktop: MUI Dialog centrado
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
 * @param {boolean} forceDesktop - Force desktop modal even on mobile
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
  forceDesktop = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Mapeo de tamaños a maxWidth de MUI Dialog
  const sizeMap = {
    sm: "sm",      // 444px
    md: "sm",      // 444px (md de MUI es 600px, muy grande)
    lg: "md",      // 600px
    xl: "lg",      // 900px
    full: "xl",    // 1200px
  };

  // Estilos personalizados para el Dialog
  const dialogSx = {
    '& .MuiDialog-paper': {
      boxShadow: 'var(--shadow-xl)',
      border: '1px solid var(--border)',
      backgroundColor: 'var(--card)',
      backgroundImage: 'none',
      maxHeight: '90vh',
    },
    '& .MuiBackdrop-root': {
      backgroundColor: 'var(--overlay)',
      backdropFilter: 'blur(4px)',
    },
  };

  // Estilos para el título
  const titleSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg-soft)',
    '& .MuiTypography-root': {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: 'var(--fg)',
    },
  };

  // Estilos para el contenido
  const contentSx = {
    padding: '24px',
    color: 'var(--fg)',
    '&:first-of-type': {
      paddingTop: '24px',
    },
  };

  // Estilos para las acciones/footer
  const actionsSx = {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg-soft)',
    gap: '12px',
  };

  // Mobile: Bottom Sheet usando SwipeableDrawer
  if (isMobile && !forceDesktop) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={isOpen}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        swipeAreaWidth={0}
        ModalProps={{
          keepMounted: false,
        }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            maxHeight: '90vh',
            backgroundColor: 'var(--card)',
            boxShadow: 'var(--shadow-xl)',
          },
        }}
      >
        <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
          {/* Swipe indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--border)]">
            <h2 id="modal-title" className="text-lg font-semibold text-[var(--fg)]">
              {title}
            </h2>
            {showCloseButton && (
              <IconButton
                onClick={onClose}
                size="small"
                sx={{ color: 'var(--fg-muted)' }}
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </IconButton>
            )}
          </div>

          {/* Content */}
          <div className="px-4 py-4 overflow-y-auto max-h-[60vh]">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 pb-4 pt-3 border-t border-[var(--border)] bg-[var(--bg-soft)]">
              {footer}
            </div>
          )}
        </div>
      </SwipeableDrawer>
    );
  }

  // Desktop: MUI Dialog
  return (
    <Dialog
      open={isOpen}
      onClose={closeOnOverlayClick ? onClose : undefined}
      TransitionComponent={Transition}
      maxWidth={sizeMap[size]}
      fullWidth
      sx={dialogSx}
      aria-labelledby="modal-title"
    >
      <DialogTitle sx={titleSx} id="modal-title">
        <span>{title}</span>
        {showCloseButton && (
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'var(--fg-muted)',
              '&:hover': {
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--fg)',
              },
            }}
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={contentSx} className={className}>
        {children}
      </DialogContent>

      {footer && (
        <DialogActions sx={actionsSx}>
          {footer}
        </DialogActions>
      )}
    </Dialog>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl", "full"]),
  closeOnOverlayClick: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  footer: PropTypes.node,
  className: PropTypes.string,
  forceDesktop: PropTypes.bool,
};

export default Modal;
