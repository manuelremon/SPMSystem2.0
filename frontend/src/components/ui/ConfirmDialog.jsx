/**
 * ConfirmDialog - MUI-based confirmation dialog
 *
 * Reusable confirmation dialog built on MUI Dialog.
 * Supports variants: info (default), warning, error.
 *
 * Props:
 *   open        - boolean, dialog visibility
 *   onClose     - function, called on cancel/close
 *   onConfirm   - function, called on confirm click
 *   title       - string, dialog title
 *   description - string|ReactNode, dialog message
 *   confirmText - string, confirm button label (default: "Confirmar")
 *   cancelText  - string, cancel button label (default: "Cancelar")
 *   variant     - "info" | "warning" | "error" (default: "info")
 *   loading     - boolean, shows spinner on confirm button
 */
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckIcon from '@mui/icons-material/Check';

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmText = "Confirmar", cancelText = "Cancelar", variant = "info", loading }) {
  const getVariantColor = () => {
    switch (variant) {
      case "warning":
        return "warning";
      case "error":
        return "error";
      default:
        return "primary";
    }
  };

  const getVariantIcon = () => {
    switch (variant) {
      case "warning":
      case "error":
        return <WarningAmberIcon sx={{ fontSize: 24 }} />;
      default:
        return <CheckIcon sx={{ fontSize: 24 }} />;
    }
  };

  const color = getVariantColor();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: {} }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: "50%",
            bgcolor: `${color}.lighter`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: `${color}.main`,
          }}
        >
          {getVariantIcon()}
        </Box>
        <Typography variant="subtitle1" component="span" fontWeight={600} color="text.primary">
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: "grey.50" }}>
        <Button onClick={onClose} variant="outlined" size="small" sx={{ textTransform: "none" }}>
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={color}
          size="small"
          sx={{ textTransform: "none" }}
        >
          {loading ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
