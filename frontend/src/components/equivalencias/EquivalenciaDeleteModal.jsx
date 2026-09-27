/**
 * Confirmación de borrado de una equivalencia (borrado físico).
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { equivalencias } from "../../services/spm";
import { useI18n } from "../../context/i18n";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {{id: number, codigo_original: string, codigo_equivalente: string} | null} props.item
 * @param {() => void} props.onClose
 * @param {(mensaje: string) => void} props.onDeleted
 */
export default function EquivalenciaDeleteModal({ open, item, onClose, onDeleted }) {
  const { t } = useI18n();
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  if (!item) return null;

  const confirmar = async () => {
    setBorrando(true);
    setError("");
    try {
      await equivalencias.eliminar(item.id);
      onDeleted(t("equiv_eliminada", "Equivalencia eliminada correctamente"));
    } catch {
      setError(t("equiv_error_eliminar", "No se pudo eliminar la equivalencia. Intenta nuevamente."));
    } finally {
      setBorrando(false);
    }
  };

  return (
    <Dialog open={open} onClose={borrando ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "grey.200", color: "error.main" }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {t("equiv_eliminar_titulo", "Eliminar equivalencia")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common_cerrar", "Cerrar")} disabled={borrando}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("equiv_eliminar_pregunta", "¿Eliminar la equivalencia entre")}{" "}
          <Box component="strong" sx={{ fontFamily: "monospace", color: "primary.main" }}>
            {item.codigo_original}
          </Box>{" "}
          {t("equiv_y", "y")}{" "}
          <Box component="strong" sx={{ fontFamily: "monospace", color: "secondary.main" }}>
            {item.codigo_equivalente}
          </Box>
          ?
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "grey.200", bgcolor: "grey.50" }}>
        <Button onClick={onClose} disabled={borrando} color="inherit" sx={{ textTransform: "none" }}>
          {t("common_cancelar", "Cancelar")}
        </Button>
        <Button
          onClick={confirmar}
          variant="contained"
          color="error"
          disabled={borrando}
          startIcon={borrando ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none" }}
        >
          {borrando ? t("common_eliminando", "Eliminando...") : t("common_eliminar", "Eliminar")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
