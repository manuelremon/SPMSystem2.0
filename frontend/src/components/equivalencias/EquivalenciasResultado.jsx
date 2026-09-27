import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useI18n } from "../../context/i18n";
import MaterialResultadoCard from "./MaterialResultadoCard";

export const TIPO_CONFIG = {
  E1_ESTRICTA: { labelKey: "equiv_bot_tipo_e1", fallback: "Estricta", color: "success" },
  E2_SUPLIBLE: { labelKey: "equiv_bot_tipo_e2", fallback: "Suplible", color: "warning" },
  E0_DUPLICADO: { labelKey: "equiv_bot_tipo_e0", fallback: "Duplicado", color: "info" },
};

/** Equivalencias de un material agrupadas por tipo. */
export default function EquivalenciasResultado({ equivalencias, onVerEquivalentes, onFiltrar, onAgregar, puedeAgregar = false }) {
  const { t } = useI18n();
  const { grupos = [] } = equivalencias || {};

  if (grupos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("equiv_bot_sin_equivalencias", "Este material no tiene equivalencias registradas.")}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {grupos.map((grupo) => {
        const cfg = TIPO_CONFIG[grupo.tipo] || { labelKey: grupo.tipo, fallback: grupo.tipo, color: "default" };
        return (
          <Box key={grupo.tipo}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Chip
                size="small"
                color={cfg.color}
                label={`${t(cfg.labelKey, cfg.fallback)}${grupo.compatibilidad_pct != null ? ` · ${grupo.compatibilidad_pct}%` : ""}`}
                sx={{ fontWeight: 600 }}
              />
              {grupo.total > grupo.items.length && (
                <Typography variant="caption" color="text.secondary">
                  {`${t("equiv_bot_mostrando", "Mostrando")} ${grupo.items.length} ${t("equiv_bot_de", "de")} ${grupo.total}`}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {grupo.items.map((item) => (
                <Box key={item.codigo}>
                  <MaterialResultadoCard
                    compact
                    material={{ ...item, cant_equivalencias: 0 }}
                    onVerEquivalentes={onVerEquivalentes}
                    onFiltrar={onFiltrar}
                    onAgregar={onAgregar}
                    puedeAgregar={puedeAgregar}
                  />
                  {(item.motivo || item.criterio) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, pl: 1 }}>
                      {[item.criterio, item.motivo].filter(Boolean).join(" · ")}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
