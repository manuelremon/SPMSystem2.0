import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import { useI18n } from "../../context/i18n";
import { formatCurrency } from "../../utils/formatters";

const botonSx = { textTransform: "none", fontSize: "0.75rem", minWidth: 0, px: 1 };

/** Tarjeta de un material devuelto por el buscador. */
export default function MaterialResultadoCard({ material, compact = false, onVerEquivalentes, onFiltrar, onAgregar, puedeAgregar = false }) {
  const { t } = useI18n();
  const { codigo, descripcion, unidad, precio_usd: precio, cant_equivalencias: cantEquiv } = material;

  return (
    <Paper variant="outlined" sx={{ p: compact ? 1 : 1.5, bgcolor: "background.paper" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700, color: "primary.main" }}>
          {codigo}
        </Typography>
        {unidad && <Chip label={unidad} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />}
        {precio != null && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
            {formatCurrency(precio)}
          </Typography>
        )}
      </Box>
      <Typography variant="body2" sx={{ mt: 0.5, fontSize: compact ? "0.8rem" : "0.85rem", wordBreak: "break-word" }}>
        {descripcion}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
        {cantEquiv > 0 && (
          <Button size="small" startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />} onClick={() => onVerEquivalentes(codigo)} sx={botonSx}>
            {t("equiv_bot_ver_equivalentes", "Ver equivalentes")} ({cantEquiv})
          </Button>
        )}
        <Button size="small" startIcon={<FilterListIcon sx={{ fontSize: 16 }} />} onClick={() => onFiltrar(codigo)} sx={botonSx}>
          {t("equiv_bot_filtrar_tabla", "Filtrar tabla")}
        </Button>
        {puedeAgregar && (
          <Button size="small" startIcon={<AddShoppingCartIcon sx={{ fontSize: 16 }} />} onClick={(e) => onAgregar(material, e.currentTarget)} sx={botonSx}>
            {t("equiv_bot_agregar", "Agregar a solicitud")}
          </Button>
        )}
      </Box>
    </Paper>
  );
}
