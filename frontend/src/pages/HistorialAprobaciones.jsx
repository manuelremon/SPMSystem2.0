/**
 * HistorialAprobaciones - Historial de aprobaciones de solicitudes
 * MUI Components Version
 */

import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/i18n";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  IconButton,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HistoryIcon from "@mui/icons-material/History";

export default function HistorialAprobaciones() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: "text.secondary",
              bgcolor: "background.paper",
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          component="h1"
          fontWeight={700}
          textTransform="uppercase"
          letterSpacing="0.05em"
          color="text.primary"
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
    </Box>
  );
}
