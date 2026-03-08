/**
 * HistorialAprobaciones - Historial de aprobaciones de solicitudes
 * MUI Components Version
 */

import { useI18n } from "../context/i18n";

// MUI Components
import {
  Box,
  Paper,
  Typography,
} from "@mui/material";

// MUI Icons
import HistoryIcon from "@mui/icons-material/History";

export default function HistorialAprobaciones() {
  const { t } = useI18n();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Page Header */}
      <Box sx={{ position: "relative" }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontWeight: 700,
            color: "text.primary",
            textTransform: "uppercase",
            letterSpacing: "-0.025em",
          }}
        >
          {t("historial_aprobaciones_page_title", "Historial de Aprobaciones")}
        </Typography>
      </Box>

      {/* Content Card */}
      <Paper
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        {/* Card Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <HistoryIcon sx={{ fontSize: 20, color: "primary.main" }} />
            {t("historial_title", "Historial de Aprobaciones")}
          </Typography>
        </Box>

        {/* Card Content */}
        <Box sx={{ px: 3, py: 6 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 6,
            }}
          >
            <HistoryIcon
              sx={{
                fontSize: 48,
                color: "text.disabled",
                mb: 2,
              }}
            />
            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                textAlign: "center",
              }}
            >
              {t("historial_coming_soon", "Vista de historial de aprobaciones proximamente...")}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
