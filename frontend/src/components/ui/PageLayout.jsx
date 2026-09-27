import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useI18n } from "../../context/i18n";

/**
 * Encabezado canonico de pagina: [volver] TITULO (+ subtitulo) ........ [acciones]
 *
 * - backTo: ruta a la que vuelve (por defecto, pagina anterior). backTo={false} oculta el boton.
 * - title: string (se muestra en mayusculas).
 * - subtitle: texto secundario opcional, debajo del titulo.
 * - actions: nodos a la derecha (botones). En mobile pasan debajo del titulo.
 * - status: nodo opcional junto al titulo (p.ej. un StatusBadge).
 */
export function PageTitleBar({ title, subtitle, actions, status, backTo }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const volver = () => (typeof backTo === "string" ? navigate(backTo) : navigate(-1));

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {backTo !== false && (
          <IconButton
            onClick={volver}
            aria-label={t("common_volver", "Volver")}
            sx={{
              color: "text.secondary",
              flexShrink: 0,
              "&:hover": { color: "text.primary", bgcolor: "background.paper" },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontSize: { xs: "1.15rem", sm: "1.5rem" },
                lineHeight: 1.25,
              }}
            >
              {title}
            </Typography>
            {status}
          </Box>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {actions && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", ml: { xs: 0, sm: "auto" } }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}

/**
 * Layout canonico de pagina. El fondo y el padding exterior los pone Layout.jsx;
 * esta caja separa las secciones y ocupa todo el ancho de la ventana.
 * maxWidth solo para vistas angostas por diseño (p. ej. formularios).
 */
export default function PageLayout({
  title,
  subtitle,
  actions,
  status,
  backTo,
  maxWidth = "none",
  gap = 3,
  children,
}) {
  return (
    <Box sx={{ width: "100%", maxWidth, mx: "auto", display: "flex", flexDirection: "column", gap }}>
      {title && (
        <PageTitleBar title={title} subtitle={subtitle} actions={actions} status={status} backTo={backTo} />
      )}
      {children}
    </Box>
  );
}
