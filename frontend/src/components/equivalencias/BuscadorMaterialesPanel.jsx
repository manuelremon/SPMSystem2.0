import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SendIcon from "@mui/icons-material/Send";
import { useI18n } from "../../context/i18n";
import { useUserRoles } from "../../hooks/useUserRoles";
import { useBuscadorMateriales } from "./useBuscadorMateriales";
import MaterialResultadoCard from "./MaterialResultadoCard";
import EquivalenciasResultado from "./EquivalenciasResultado";
import AgregarASolicitudMenu from "./AgregarASolicitudMenu";

const EJEMPLOS = [
  { key: "equiv_bot_ejemplo_1", fallback: "bomba centrífuga" },
  { key: "equiv_bot_ejemplo_2", fallback: "rodamiento 6205" },
  { key: "equiv_bot_ejemplo_3", fallback: "equivalentes de rodamiento 6205" },
];
const MAX_CARACTERES = 300;

function textoBot(respuesta, t) {
  const { intencion, consulta, materiales = [], equivalencias } = respuesta;
  if (intencion === "ayuda") return t("equiv_bot_ayuda", "Describe el material que buscas o escribe un código SAP.");
  if (intencion === "sin_resultados") {
    return t("equiv_bot_sin_resultados", "No encontré materiales. Prueba con menos palabras, con abreviaturas (p. ej. CENTRIF) o con el código SAP.");
  }
  if (intencion === "descripcion") {
    return `${t("equiv_bot_encontre", "Encontré")} ${materiales.length} ${t("equiv_bot_materiales_para", "materiales para")} «${consulta}».`;
  }
  const codigo = equivalencias?.material?.codigo || materiales[0]?.codigo || "";
  return `${t("equiv_bot_equivalencias_de", "Equivalencias de")} ${codigo}:`;
}

function Burbuja({ rol, children }) {
  const esUsuario = rol === "usuario";
  return (
    <Box sx={{ display: "flex", justifyContent: esUsuario ? "flex-end" : "flex-start" }}>
      <Box
        sx={{
          maxWidth: esUsuario ? "85%" : "100%",
          width: esUsuario ? "auto" : "100%",
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: esUsuario ? "primary.main" : "grey.100",
          color: esUsuario ? "primary.contrastText" : "text.primary",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/** Buscador conversacional de materiales (pagina Equivalencias). */
export default function BuscadorMaterialesPanel({ onFiltrarTabla, onCerrar }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { hasRole, isAdmin } = useUserRoles();
  const { mensajes, cargando, enviar, reintentar, limpiar } = useBuscadorMateriales();
  const [texto, setTexto] = useState("");
  const [menu, setMenu] = useState({ material: null, anchorEl: null });
  const [aviso, setAviso] = useState(null);
  const finRef = useRef(null);

  const puedeAgregar = !hasRole("compartidos") || isAdmin;

  useEffect(() => {
    finRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [mensajes, cargando]);

  const enviarTexto = () => {
    if (!texto.trim()) return;
    enviar(texto);
    setTexto("");
  };

  const accionesTarjeta = {
    onVerEquivalentes: (codigo) => enviar(`equivalentes de ${codigo}`),
    onFiltrar: onFiltrarTabla,
    onAgregar: (material, anchorEl) => setMenu({ material, anchorEl }),
    puedeAgregar,
  };

  return (
    <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Encabezado */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
        <ForumOutlinedIcon sx={{ color: "primary.main", fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          {t("equiv_bot_titulo", "Buscador de materiales")}
        </Typography>
        <Tooltip title={t("equiv_bot_limpiar", "Limpiar conversación")}>
          <span>
            <IconButton size="small" onClick={limpiar} disabled={mensajes.length === 0} aria-label={t("equiv_bot_limpiar", "Limpiar conversación")}>
              <DeleteSweepIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {onCerrar && (
          <IconButton size="small" onClick={onCerrar} aria-label={t("common_cerrar", "Cerrar")}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Mensajes */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }} aria-live="polite">
        <Burbuja rol="bot">
          <Typography variant="body2">{t("equiv_bot_ayuda", "Describe el material que buscas o escribe un código SAP.")}</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
            {EJEMPLOS.map((ej) => (
              <Chip
                key={ej.key}
                data-testid="equiv-bot-ejemplo"
                label={t(ej.key, ej.fallback)}
                size="small"
                variant="outlined"
                onClick={() => enviar(t(ej.key, ej.fallback))}
                sx={{ bgcolor: "background.paper" }}
              />
            ))}
          </Box>
        </Burbuja>

        {mensajes.map((m) => {
          if (m.rol === "usuario") {
            return (
              <Burbuja key={m.id} rol="usuario">
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{m.texto}</Typography>
              </Burbuja>
            );
          }
          if (m.error) {
            return (
              <Burbuja key={m.id} rol="bot">
                <Typography variant="body2" color="error.main">
                  {m.error === "rate_limit"
                    ? t("equiv_bot_rate_limit", "Demasiadas consultas; espera un momento.")
                    : t("equiv_bot_error", "No pude completar la búsqueda.")}
                </Typography>
                <Button size="small" onClick={() => reintentar(m.consulta)} sx={{ mt: 0.5, textTransform: "none" }}>
                  {t("equiv_bot_reintentar", "Reintentar")}
                </Button>
              </Burbuja>
            );
          }
          const r = m.respuesta;
          const esEquivalencias = r.intencion === "codigo" || r.intencion === "equivalencias";
          return (
            <Burbuja key={m.id} rol="bot">
              <Typography variant="body2" sx={{ mb: 1 }}>{textoBot(r, t)}</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {r.materiales.map((mat) => (
                  <MaterialResultadoCard key={mat.codigo} material={esEquivalencias ? { ...mat, cant_equivalencias: 0 } : mat} {...accionesTarjeta} />
                ))}
                {esEquivalencias && <EquivalenciasResultado equivalencias={r.equivalencias} {...accionesTarjeta} />}
              </Box>
              {r.sugerencias?.length > 0 && r.intencion !== "ayuda" && r.intencion !== "sin_resultados" && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                  {r.sugerencias.map((s) => (
                    <Chip key={s} label={s} size="small" variant="outlined" onClick={() => enviar(s)} sx={{ bgcolor: "background.paper" }} />
                  ))}
                </Box>
              )}
            </Burbuja>
          );
        })}

        {cargando && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
            <CircularProgress size={14} />
            <Typography variant="caption">{t("equiv_bot_buscando", "Buscando...")}</Typography>
          </Box>
        )}
        <div ref={finRef} />
      </Box>

      {/* Entrada */}
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, p: 1.5, borderTop: 1, borderColor: "divider" }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_CARACTERES))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviarTexto();
            }
          }}
          placeholder={t("equiv_bot_placeholder", "Ej.: válvula esférica 2 pulgadas")}
        />
        <IconButton color="primary" onClick={enviarTexto} disabled={cargando || !texto.trim()} aria-label={t("equiv_bot_enviar", "Enviar")}>
          <SendIcon />
        </IconButton>
      </Box>

      <AgregarASolicitudMenu
        material={menu.material}
        anchorEl={menu.anchorEl}
        onClose={() => setMenu({ material: null, anchorEl: null })}
        onAviso={setAviso}
      />
      <Snackbar open={Boolean(aviso)} autoHideDuration={6000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {aviso ? (
          <Alert
            severity={aviso.tipo === "success" ? "success" : "error"}
            onClose={() => setAviso(null)}
            action={
              aviso.tipo === "success" ? (
                <Button color="inherit" size="small" onClick={() => navigate(`/solicitudes/${aviso.solicitudId}/materiales`)}>
                  {t("equiv_bot_ir_borrador", "Ir al borrador")}
                </Button>
              ) : undefined
            }
          >
            {aviso.tipo === "success"
              ? `${t("equiv_bot_agregado", "Agregado a la solicitud")} #${aviso.solicitudId}`
              : aviso.mensaje || t("equiv_bot_error_agregar", "No se pudo agregar el material")}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>
    </Paper>
  );
}
