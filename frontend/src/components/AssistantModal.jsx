import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
} from "@mui/material";
import {
  AutoAwesome as SparklesIcon,
  Check as CheckIcon,
  Add as PlusIcon,
  Error as AlertCircleIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import api from "../services/api";
import { useI18n } from "../context/i18n";

/**
 * AssistantModal - Modal del asistente NLP para crear solicitudes
 *
 * Permite al usuario describir un problema en lenguaje natural
 * y recibe sugerencias de materiales basadas en análisis NLP.
 *
 * @param {boolean} isOpen - Controla visibilidad del modal
 * @param {function} onClose - Callback para cerrar
 * @param {function} onUseSuggestions - Callback con {items, justificacion}
 */
export function AssistantModal({ isOpen, onClose, onUseSuggestions }) {
  const { t } = useI18n();
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);

  const handleAnalizar = useCallback(async () => {
    if (!descripcion.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await api.post("/assistant/solicitudes/sugerir", {
        descripcion,
      });

      if (res.data?.ok) {
        setResult(res.data);
        // Seleccionar todos los items por defecto
        const allIds = res.data.sugerencias?.map((s) => s.material_id) || [];
        setSelectedItems(allIds);
      } else {
        setError(res.data?.error?.message || "Error al analizar");
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [descripcion]);

  const toggleItem = useCallback((materialId) => {
    setSelectedItems((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    );
  }, []);

  const handleUsar = useCallback(() => {
    if (!result || selectedItems.length === 0) return;

    const items = result.sugerencias
      .filter((s) => selectedItems.includes(s.material_id))
      .map((s) => ({
        codigo: s.codigo_sap,
        codigo_sap: s.codigo_sap,
        descripcion: s.descripcion,
        cantidad: s.cantidad_sugerida,
        precio_unitario: s.precio_unitario || 0,
        unidad: s.unidad,
      }));

    onUseSuggestions({
      items,
    });

    // Reset state
    setDescripcion("");
    setResult(null);
    setSelectedItems([]);
    onClose();
  }, [result, selectedItems, onUseSuggestions, onClose]);

  const handleClose = useCallback(() => {
    setError("");
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {}
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">
          {t("assistant_title", "Asistente IA")}
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {/* Descripción del problema */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: "text.secondary",
                display: "block",
                mb: 0.75,
              }}
            >
              {t("assistant_describe", "Describí el problema o necesidad")}
            </Typography>
            <TextField
              id="assistant-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={t(
                "assistant_placeholder",
                "Ej: Se rompió la bomba de agua de la línea 3, pierde por el sello mecánico..."
              )}
              multiline
              rows={4}
              fullWidth
              size="small"
            />
          </Box>

          {/* Error message */}
          {error && (
            <Alert severity="error" icon={<AlertCircleIcon />}>
              {error}
            </Alert>
          )}

          {/* Botón analizar */}
          <Button
            variant="contained"
            onClick={handleAnalizar}
            disabled={!descripcion.trim() || loading}
            fullWidth
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SparklesIcon />}
          >
            {loading
              ? t("assistant_analyzing", "Analizando...")
              : t("assistant_analyze", "Analizar y sugerir materiales")}
          </Button>

          {/* Resultados */}
          {result && (
            <Stack spacing={2} sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
              {/* Análisis - Entidades detectadas */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    display: "block",
                    mb: 1,
                  }}
                >
                  {t("assistant_detected", "Detectado en tu descripción")}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {result.analisis?.equipos_detectados?.map((e) => (
                    <Chip key={`equipo-${e}`} label={e} color="info" size="small" />
                  ))}
                  {result.analisis?.componentes_detectados?.map((c) => (
                    <Chip key={`comp-${c}`} label={c} color="success" size="small" />
                  ))}
                  {result.analisis?.tipo_falla?.map((f) => (
                    <Chip key={`falla-${f}`} label={f} color="warning" size="small" />
                  ))}
                </Stack>
              </Box>

              {/* Materiales sugeridos */}
              {result.sugerencias?.length > 0 ? (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "text.secondary",
                      display: "block",
                      mb: 1,
                    }}
                  >
                    {t("assistant_suggestions", "Materiales sugeridos")} ({result.sugerencias.length})
                  </Typography>
                  <Box sx={{ maxHeight: 256, overflowY: "auto" }}>
                    <Stack spacing={1}>
                      {result.sugerencias.map((sug) => (
                        <Paper
                          key={sug.material_id}
                          onClick={() => toggleItem(sug.material_id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === "Enter" && toggleItem(sug.material_id)}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            border: 1,
                            borderColor: selectedItems.includes(sug.material_id)
                              ? "primary.main"
                              : "divider",
                            bgcolor: selectedItems.includes(sug.material_id)
                              ? "primary.lighter"
                              : "transparent",
                            "&:hover": {
                              borderColor: selectedItems.includes(sug.material_id)
                                ? "primary.main"
                                : "action.hover",
                            },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                noWrap
                              >
                                {sug.descripcion}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                              >
                                {sug.codigo_sap} · {sug.motivo}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                              <Typography
                                variant="body2"
                                fontWeight="bold"
                                sx={{ fontVariantNumeric: "tabular-nums" }}
                              >
                                {sug.cantidad_sugerida} {sug.unidad}
                              </Typography>
                              {selectedItems.includes(sug.material_id) && (
                                <CheckIcon color="primary" sx={{ width: 16, height: 16 }} />
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ textAlign: "center", py: 3 }}>
                  <AlertCircleIcon sx={{ width: 32, height: 32, color: "text.disabled", mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {t("assistant_no_results", "No se encontraron materiales. Intenta con otra descripción.")}
                  </Typography>
                </Box>
              )}

              {/* Botón usar sugerencias */}
              {result.sugerencias?.length > 0 && (
                <Button
                  variant="contained"
                  onClick={handleUsar}
                  disabled={selectedItems.length === 0}
                  fullWidth
                  startIcon={<PlusIcon />}
                >
                  {t("assistant_use", "Usar estas sugerencias")} ({selectedItems.length})
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default AssistantModal;
