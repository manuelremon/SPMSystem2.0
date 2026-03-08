/**
 * AnalisisPuntualHome - Centro de importacion de datos temporales
 *
 * Permite a administradores:
 * - Importar archivo Excel con datos para analisis
 * - Ver estado actual de datos temporales
 * - Acceder a MRP y Forecast temporales
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../context/i18n";
import { TempDataBanner } from "../../components/ui/TempDataBanner";
import { ImportExcelModal } from "../../components/admin/ImportExcelModal";

// MUI Components
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

export default function AnalisisPuntualHome() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [showImportModal, setShowImportModal] = useState(false);
  const [tempDataActive, setTempDataActive] = useState(false);

  const handleImportSuccess = useCallback(() => {
    setTempDataActive(true);
    setShowImportModal(false);
  }, []);

  const handleStatusChange = useCallback((active) => {
    setTempDataActive(active);
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: "#606d80" }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t("admin_ap_titulo", "ANÁLISIS PUNTUAL")}
        </Typography>
      </Box>

      {/* Banner de estado */}
      <TempDataBanner onStatusChange={handleStatusChange} />

      {/* Contenido segun estado */}
      {tempDataActive ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mt: 3 }}>
          {/* Card MRP */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Box sx={{ width: 48, height: 48, bgcolor: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WarningAmberIcon sx={{ color: "#f59e0b", fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1f1f20" }}>
                  {t("admin_ap_mrp", "MRP Temporal")}
                </Typography>
                <Typography variant="body2" sx={{ color: "#606d80" }}>
                  Alertas y KPIs con datos importados
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate("/admin/analisis-puntual/mrp")}
              sx={{ bgcolor: "primary.main", textTransform: "none", fontWeight: 600 }}
            >
              {t("admin_ap_abrir_mrp", "Abrir MRP Temporal")}
            </Button>
          </Paper>

          {/* Card Forecast */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Box sx={{ width: 48, height: 48, bgcolor: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShowChartIcon sx={{ color: "#3b82f6", fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1f1f20" }}>
                  {t("admin_ap_forecast", "Forecast Temporal")}
                </Typography>
                <Typography variant="body2" sx={{ color: "#606d80" }}>
                  Pronósticos con consumo histórico importado
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate("/admin/analisis-puntual/forecast")}
              sx={{ bgcolor: "primary.main", textTransform: "none", fontWeight: 600 }}
            >
              {t("admin_ap_abrir_forecast", "Abrir Forecast Temporal")}
            </Button>
          </Paper>
        </Box>
      ) : (
        /* Estado sin datos */
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", p: 6, textAlign: "center", mt: 3 }}>
          <Box sx={{ width: 80, height: 80, borderRadius: "50%", bgcolor: "#f5f7fa", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 3 }}>
            <InsertDriveFileIcon sx={{ fontSize: 40, color: "#9ca3af" }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#1f1f20", mb: 1 }}>
            {t("admin_ap_sin_datos", "Sin datos temporales cargados")}
          </Typography>
          <Typography variant="body2" sx={{ color: "#606d80", mb: 4 }}>
            {t("admin_ap_sin_datos_desc", "Importa un archivo Excel para comenzar el análisis.")}
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => setShowImportModal(true)}
            sx={{ bgcolor: "primary.main", textTransform: "none", fontWeight: 600 }}
          >
            {t("admin_ap_importar_excel", "Importar Excel")}
          </Button>
        </Paper>
      )}

      {/* Modal de importacion */}
      <ImportExcelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
      </Box>
    </Box>
  );
}
