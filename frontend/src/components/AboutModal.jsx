import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Stack,
  Divider,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useI18n } from "../context/i18n";

export default function AboutModal({ open, onClose }) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        {t("about_title", "Acerca de SPM System")}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: "center", py: 2 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            SPM System 2.0
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t("about_subtitle", "Sistema de Planificación de Materiales")}
          </Typography>
          <Chip
            label={`${t("about_version", "Versión")} 2.0`}
            size="small"
            color="primary"
            sx={{ mt: 1, mb: 2 }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            "about_description",
            "Plataforma integral para la gestión de solicitudes de materiales, planificación de compras y seguimiento de inventario. Diseñada para optimizar la cadena de suministro con herramientas de análisis predictivo e inteligencia artificial."
          )}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          {t("about_stack", "Tecnologías")}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip label="React" size="small" variant="outlined" />
          <Chip label="Flask" size="small" variant="outlined" />
          <Chip label="PostgreSQL" size="small" variant="outlined" />
          <Chip label="Redis" size="small" variant="outlined" />
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
          © 2025-2026 SPM System
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
