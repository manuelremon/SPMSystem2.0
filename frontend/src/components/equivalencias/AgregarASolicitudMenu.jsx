import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import { useI18n } from "../../context/i18n";
import { solicitudes } from "../../services/spm";
import { useUser } from "../../store/authStore";

const MAX_BORRADORES = 5;

/** Suma 1 al material si ya esta en los items; si no, lo agrega con cantidad 1. */
export function sumarMaterial(items, material) {
  const conCodigo = (items || []).map((it) => ({ ...it, codigo: it.codigo || it.material_id }));
  if (conCodigo.some((it) => it.codigo === material.codigo)) {
    return conCodigo.map((it) =>
      it.codigo === material.codigo ? { ...it, cantidad: Number(it.cantidad || 0) + 1 } : it
    );
  }
  return [
    ...conCodigo,
    { codigo: material.codigo, descripcion: material.descripcion, unidad: material.unidad || "UNI", cantidad: 1 },
  ];
}

export default function AgregarASolicitudMenu({ material, anchorEl, onClose, onAviso }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useUser();
  const [borradores, setBorradores] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const open = Boolean(anchorEl && material);

  useEffect(() => {
    if (!open || !user?.id) return undefined;
    let vigente = true;
    setCargando(true);
    solicitudes
      .listar({ user_id: user.id, estado: "draft", page_size: MAX_BORRADORES })
      .then((res) => {
        if (!vigente) return;
        const propios = (res.data?.solicitudes || []).filter((s) => String(s.id_usuario) === String(user.id));
        setBorradores(propios.slice(0, MAX_BORRADORES));
      })
      .catch(() => vigente && setBorradores([]))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [open, user?.id]);

  const agregarABorrador = async (id) => {
    setGuardando(true);
    try {
      const res = await solicitudes.obtener(id);
      const sol = res.data?.solicitud || res.data || {};
      await solicitudes.guardarBorrador(id, sumarMaterial(sol.items, material));
      onAviso({ tipo: "success", solicitudId: id });
    } catch (err) {
      onAviso({ tipo: "error", mensaje: err?.response?.data?.error?.message });
    } finally {
      setGuardando(false);
      onClose();
    }
  };

  const nuevaSolicitud = () => {
    try {
      sessionStorage.setItem(
        "suggested_items",
        JSON.stringify([{ codigo: material.codigo, descripcion: material.descripcion, unidad: material.unidad || "UNI", cantidad: 1 }])
      );
    } catch {
      // sessionStorage no disponible: se navega igual, sin precarga
    }
    onClose();
    navigate("/solicitudes/nueva");
  };

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose} slotProps={{ paper: { sx: { maxWidth: 340 } } }}>
      <ListSubheader sx={{ lineHeight: "32px" }}>{t("equiv_bot_mis_borradores", "Mis borradores")}</ListSubheader>
      {cargando && (
        <MenuItem disabled>
          <CircularProgress size={16} sx={{ mr: 1 }} /> {t("common_cargando", "Cargando...")}
        </MenuItem>
      )}
      {!cargando && borradores.length === 0 && (
        <MenuItem disabled>
          <Typography variant="body2">{t("equiv_bot_sin_borradores", "No tienes borradores")}</Typography>
        </MenuItem>
      )}
      {borradores.map((b) => (
        <MenuItem key={b.id} disabled={guardando} onClick={() => agregarABorrador(b.id)}>
          <Typography variant="body2" noWrap>
            {`#${b.id} · ${b.justificacion || t("equiv_bot_sin_asunto", "Sin asunto")} (${(b.items || []).length} ${t("equiv_bot_items", "ítems")})`}
          </Typography>
        </MenuItem>
      ))}
      <Divider />
      <MenuItem disabled={guardando} onClick={nuevaSolicitud}>
        <NoteAddIcon fontSize="small" sx={{ mr: 1, color: "primary.main" }} />
        {t("equiv_bot_nueva_solicitud", "Nueva solicitud")}
      </MenuItem>
    </Menu>
  );
}
