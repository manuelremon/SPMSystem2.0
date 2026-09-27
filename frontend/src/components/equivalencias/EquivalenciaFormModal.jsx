/**
 * Alta / edición de una equivalencia de material.
 * Crear: el material original viene fijo (el material abierto) y se busca el equivalente.
 * Editar: solo tipo, criterio y motivo.
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { equivalencias, materiales } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { TIPO_CONFIG } from "./EquivalenciasResultado";

const DEBOUNCE_MS = 300;
const MAX_TEXTO = 500;
const TIPOS = ["E1_ESTRICTA", "E2_SUPLIBLE", "E0_DUPLICADO"];

const labelSx = { display: "block", fontWeight: 600, color: "text.secondary", mb: 0.5 };

function CodigoFijo({ label, codigo, descripcion, color }) {
  return (
    <Box>
      <Typography variant="caption" sx={labelSx}>{label} *</Typography>
      <Box sx={{ px: 1.5, py: 1, bgcolor: "grey.50", border: 1, borderColor: "grey.200", display: "flex", gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: "monospace", fontWeight: 600, color }}>{codigo}</Typography>
        {descripcion && (
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {descripcion}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function BuscarEquivalente({ seleccionado, onSeleccionar, excluir }) {
  const { t } = useI18n();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const debounced = useDebouncedValue(texto, DEBOUNCE_MS);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) {
      setResultados([]);
      return;
    }
    let vigente = true;
    setCargando(true);
    const params = /^[\d-]+$/.test(q) ? { codigo: q, limit: 10 } : { descripcion: q, limit: 10 };
    materiales
      .buscar(params)
      .then((res) => {
        const data = res.data?.data || res.data || [];
        if (vigente) setResultados((Array.isArray(data) ? data : []).filter((m) => m.codigo !== excluir));
      })
      .catch(() => vigente && setResultados([]))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [debounced, excluir]);

  const label = t("equiv_material_equivalente", "Material equivalente");

  if (seleccionado) {
    return (
      <Box>
        <Typography variant="caption" sx={labelSx}>{label} *</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, border: 1, borderColor: "grey.200" }}>
          <CheckIcon sx={{ fontSize: 20, color: "success.main" }} />
          <Typography sx={{ fontFamily: "monospace", fontWeight: 600, color: "secondary.main" }}>{seleccionado.codigo}</Typography>
          <Typography sx={{ flex: 1, fontSize: "0.875rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {seleccionado.descripcion}
          </Typography>
          <IconButton size="small" onClick={() => onSeleccionar(null)} aria-label={t("common_limpiar", "Limpiar")}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Typography variant="caption" sx={labelSx}>{label} *</Typography>
      <TextField
        size="small"
        fullWidth
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={t("equiv_buscar_material", "Buscar por código o descripción...")}
        inputProps={{ "aria-label": label }}
        InputProps={{
          endAdornment: cargando ? (
            <InputAdornment position="end">
              <CircularProgress size={16} />
            </InputAdornment>
          ) : null,
        }}
      />
      {resultados.length > 0 && (
        <Paper elevation={8} sx={{ position: "absolute", zIndex: 20, width: "100%", mt: 0.5, maxHeight: 220, overflow: "auto" }}>
          <List disablePadding>
            {resultados.map((mat) => (
              <ListItemButton
                key={mat.codigo}
                onClick={() => {
                  onSeleccionar(mat);
                  setTexto("");
                  setResultados([]);
                }}
                sx={{ borderBottom: 1, borderColor: "grey.100" }}
              >
                <ListItemText
                  primary={<Typography sx={{ fontFamily: "monospace", fontWeight: 600, color: "secondary.main" }}>{mat.codigo}</Typography>}
                  secondary={mat.descripcion}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

function mensajeError(err, t) {
  const status = err?.response?.status;
  if (status === 409) return t("equiv_error_duplicado", "Esa equivalencia ya existe con el mismo tipo.");
  if (status === 404) return t("equiv_error_material", "El material o la equivalencia ya no existe.");
  if (status === 403) return t("equiv_error_permiso", "No tienes permiso para gestionar equivalencias.");
  return t("equiv_error_guardar", "No se pudo guardar la equivalencia. Intenta nuevamente.");
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(mensaje: string) => void} props.onSaved
 * @param {{codigo: string, descripcion?: string}} [props.material] material original (alta)
 * @param {{id: number, codigo_original: string, codigo_equivalente: string, tipo_equivalencia?: string, criterio?: string, motivo?: string}} [props.item] equivalencia a editar
 */
export default function EquivalenciaFormModal({ open, onClose, onSaved, material, item }) {
  const { t } = useI18n();
  const editando = Boolean(item);
  const [equivalente, setEquivalente] = useState(null);
  const [tipo, setTipo] = useState("E1_ESTRICTA");
  const [criterio, setCriterio] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEquivalente(null);
    setTipo(item?.tipo_equivalencia && TIPOS.includes(item.tipo_equivalencia) ? item.tipo_equivalencia : "E1_ESTRICTA");
    setCriterio(item?.criterio || "");
    setMotivo(item?.motivo || "");
    setError("");
  }, [open, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      if (editando) {
        await equivalencias.actualizar(item.id, { tipo_equivalencia: tipo, criterio, motivo });
        onSaved(t("equiv_actualizada", "Equivalencia actualizada correctamente"));
      } else {
        await equivalencias.crear({
          codigo_original: material.codigo,
          codigo_equivalente: equivalente.codigo,
          tipo_equivalencia: tipo,
          criterio,
          motivo,
        });
        onSaved(t("equiv_creada", "Equivalencia creada correctamente"));
      }
    } catch (err) {
      setError(mensajeError(err, t));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onClose={guardando ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "grey.200", py: 2 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {editando ? t("equiv_editar_titulo", "Editar equivalencia") : t("equiv_nueva", "Nueva equivalencia")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common_cerrar", "Cerrar")} disabled={guardando}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ py: 3 }}>
          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" onClose={() => setError("")}>
                {error}
              </Alert>
            )}
            <CodigoFijo
              label={t("equiv_material_original", "Material original")}
              codigo={editando ? item.codigo_original : material?.codigo}
              descripcion={editando ? null : material?.descripcion}
              color="primary.main"
            />
            {editando ? (
              <CodigoFijo label={t("equiv_material_equivalente", "Material equivalente")} codigo={item.codigo_equivalente} color="secondary.main" />
            ) : (
              <BuscarEquivalente seleccionado={equivalente} onSeleccionar={setEquivalente} excluir={material?.codigo} />
            )}
            <TextField
              select
              size="small"
              label={t("equiv_tipo", "Tipo de equivalencia")}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              required
            >
              {TIPOS.map((valor) => (
                <MenuItem key={valor} value={valor}>
                  {t(TIPO_CONFIG[valor].labelKey, TIPO_CONFIG[valor].fallback)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label={t("equiv_criterio", "Criterio")}
              value={criterio}
              onChange={(e) => setCriterio(e.target.value)}
              inputProps={{ maxLength: MAX_TEXTO }}
              placeholder={t("equiv_criterio_placeholder", "Ej.: misma norma, mismas dimensiones...")}
            />
            <TextField
              size="small"
              label={t("equiv_motivo", "Motivo")}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              inputProps={{ maxLength: MAX_TEXTO }}
              multiline
              rows={2}
              placeholder={t("equiv_motivo_placeholder", "Por qué un material puede reemplazar al otro")}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "grey.200", bgcolor: "grey.50" }}>
          <Button onClick={onClose} disabled={guardando} color="inherit" sx={{ textTransform: "none" }}>
            {t("common_cancelar", "Cancelar")}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={guardando || (!editando && !equivalente)}
            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: "none" }}
          >
            {guardando ? t("common_guardando", "Guardando...") : editando ? t("common_actualizar", "Actualizar") : t("common_crear", "Crear")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
