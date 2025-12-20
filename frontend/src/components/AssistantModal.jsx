import { useState, useCallback } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Sparkles, Loader2, Check, Plus, AlertCircle } from "./ui/Icons";
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
      console.error("Error assistant:", err);
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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("assistant_title", "Asistente IA")}
      size="lg"
    >
      <div className="space-y-4">
        {/* Descripción del problema */}
        <div className="space-y-1.5">
          <label
            htmlFor="assistant-descripcion"
            className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
          >
            {t("assistant_describe", "Describí el problema o necesidad")}
          </label>
          <textarea
            id="assistant-descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={t(
              "assistant_placeholder",
              "Ej: Se rompió la bomba de agua de la línea 3, pierde por el sello mecánico..."
            )}
            rows={4}
            className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:ring-2 focus:ring-[var(--input-focus)] focus:border-[var(--primary)] outline-none transition-all resize-none"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Botón analizar */}
        <Button
          onClick={handleAnalizar}
          disabled={!descripcion.trim() || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("assistant_analyzing", "Analizando...")}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t("assistant_analyze", "Analizar y sugerir materiales")}
            </>
          )}
        </Button>

        {/* Resultados */}
        {result && (
          <div className="space-y-4 pt-4 border-t border-[var(--border)]">
            {/* Análisis - Entidades detectadas */}
            <div>
              <p className="text-xs text-[var(--fg-muted)] mb-2 uppercase tracking-wide">
                {t("assistant_detected", "Detectado en tu descripción")}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.analisis?.equipos_detectados?.map((e) => (
                  <Badge key={`equipo-${e}`} variant="info">
                    {e}
                  </Badge>
                ))}
                {result.analisis?.componentes_detectados?.map((c) => (
                  <Badge key={`comp-${c}`} variant="success">
                    {c}
                  </Badge>
                ))}
                {result.analisis?.tipo_falla?.map((f) => (
                  <Badge key={`falla-${f}`} variant="warning">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Materiales sugeridos */}
            {result.sugerencias?.length > 0 ? (
              <div>
                <p className="text-xs text-[var(--fg-muted)] mb-2 uppercase tracking-wide">
                  {t("assistant_suggestions", "Materiales sugeridos")} ({result.sugerencias.length})
                </p>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {result.sugerencias.map((sug) => (
                    <div
                      key={sug.material_id}
                      onClick={() => toggleItem(sug.material_id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && toggleItem(sug.material_id)}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-all
                        ${
                          selectedItems.includes(sug.material_id)
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                            : "border-[var(--border)] hover:border-[var(--border-hover)]"
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--fg)] truncate">
                            {sug.descripcion}
                          </p>
                          <p className="text-xs text-[var(--fg-muted)] truncate">
                            {sug.codigo_sap} · {sug.motivo}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-[var(--fg)] tabular-nums">
                            {sug.cantidad_sugerida} {sug.unidad}
                          </span>
                          {selectedItems.includes(sug.material_id) && (
                            <Check className="w-4 h-4 text-[hsl(var(--primary))]" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-[var(--fg-muted)]">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {t("assistant_no_results", "No se encontraron materiales. Intenta con otra descripción.")}
                </p>
              </div>
            )}

            {/* Botón usar sugerencias */}
            {result.sugerencias?.length > 0 && (
              <Button
                onClick={handleUsar}
                disabled={selectedItems.length === 0}
                className="w-full"
              >
                <Plus className="w-4 h-4" />
                {t("assistant_use", "Usar estas sugerencias")} ({selectedItems.length})
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default AssistantModal;
