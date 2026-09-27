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
import PageLayout from "../../components/ui/PageLayout";

// MUI Components
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
    <PageLayout
      title={t("admin_ap_titulo", "Análisis puntual con datos Excel")}
      subtitle={t("admin_ap_descripcion", "Importa un archivo Excel para analizar MRP y Forecast sin afectar los datos del sistema.")}
      backTo="/admin"
    >
      {/* Banner de estado */}
      <TempDataBanner onStatusChange={handleStatusChange} />

      {/* Contenido segun estado */}
      {tempDataActive ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
          {/* Card MRP */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Box sx={{ width: 48, height: 48, bgcolor: "var(--warning-bg-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WarningAmberIcon sx={{ color: "var(--warning-light)", fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                  {t("admin_ap_mrp", "MRP temporal")}
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                  {t("admin_ap_mrp_desc", "Alertas y KPI con datos importados")}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate("/admin/analisis-puntual/mrp")}
              sx={{ bgcolor: "primary.main", textTransform: "none", fontWeight: 600 }}
            >
              {t("admin_ap_abrir_mrp", "Abrir MRP temporal")}
            </Button>
          </Paper>

          {/* Card Forecast */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Box sx={{ width: 48, height: 48, bgcolor: "var(--info-bg-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShowChartIcon sx={{ color: "var(--info)", fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                  {t("admin_ap_forecast", "Forecast temporal")}
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                  {t("admin_ap_forecast_desc", "Pronósticos con consumo histórico importado")}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate("/admin/analisis-puntual/forecast")}
              sx={{ bgcolor: "primary.main", textTransform: "none", fontWeight: 600 }}
            >
              {t("admin_ap_abrir_forecast", "Abrir Forecast temporal")}
            </Button>
          </Paper>
        </Box>
      ) : (
        /* Estado sin datos */
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", p: { xs: 3, sm: 6 }, textAlign: "center" }}>
          <Box sx={{ width: 80, height: 80, borderRadius: "50%", bgcolor: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 3 }}>
            <InsertDriveFileIcon sx={{ fontSize: 40, color: "var(--fg-subtle)" }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: "var(--fg-strong)", mb: 1 }}>
            {t("admin_ap_sin_datos", "Sin datos temporales cargados")}
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--fg-muted)", mb: 4 }}>
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
    </PageLayout>
  );
}
