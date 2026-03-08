/**
 * SolicitudDetalleModal - Modal para ver detalles de solicitud en Planner
 * Muestra informacion resumida sin navegar a otra pagina
 */

import PropTypes from "prop-types";
import { useI18n } from "../../context/i18n";
import { formatDate, formatCurrency, getSectorNombre } from "../../utils/formatters";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableFooter from "@mui/material/TableFooter";

// MUI Icons
import PersonIcon from "@mui/icons-material/Person";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import InventoryIcon from "@mui/icons-material/Inventory";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DescriptionIcon from "@mui/icons-material/Description";
import CloseIcon from "@mui/icons-material/Close";

export default function SolicitudDetalleModal({ isOpen, onClose, solicitud }) {
  const { t } = useI18n();

  if (!solicitud) return null;

  const items = solicitud.items || [];
  const criticidad = solicitud.criticidad || "Normal";
  const isAltaCriticidad = criticidad.toLowerCase().includes("alta");

  // Obtener nombre completo del solicitante
  const solicitanteNombre = [
    solicitud.solicitante_nombre || solicitud.nombre,
    solicitud.solicitante_apellido || solicitud.apellido
  ].filter(Boolean).join(" ") || solicitud.id_usuario || "N/D";

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {`${t("detalle_title", "Solicitud")} #${solicitud.id}`}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Info General */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 }}>
            <InfoItem
              icon={<PersonIcon sx={{ color: "info.main" }} />}
              label={t("detalle_solicitante", "Solicitante")}
              value={solicitanteNombre}
            />
            <InfoItem
              icon={<CalendarTodayIcon sx={{ color: "warning.main" }} />}
              label={t("detalle_fecha_creacion", "Fecha Creacion")}
              value={formatDate(solicitud.created_at)}
            />
            <InfoItem
              icon={<BusinessIcon sx={{ color: "info.main" }} />}
              label={t("detalle_centro", "Centro")}
              value={solicitud.centro}
            />
            <InfoItem
              icon={<LocationOnIcon sx={{ color: "info.main" }} />}
              label={t("detalle_sector", "Sector")}
              value={getSectorNombre(solicitud.sector)}
            />
            <InfoItem
              icon={<CalendarTodayIcon sx={{ color: "warning.main" }} />}
              label={t("detalle_fecha_necesidad", "Fecha Necesidad")}
              value={formatDate(solicitud.fecha_necesidad)}
            />
            <InfoItem
              icon={<WarningAmberIcon sx={{ color: isAltaCriticidad ? "error.main" : "info.main" }} />}
              label={t("detalle_criticidad", "Criticidad")}
              value={
                <Chip
                  label={criticidad}
                  size="small"
                  color={isAltaCriticidad ? "error" : "default"}
                />
              }
            />
          </Box>

          {/* Justificacion */}
          {solicitud.justificacion && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: "grey.50" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <DescriptionIcon sx={{ fontSize: 18, color: "info.main" }} />
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", color: "text.secondary" }}>
                  {t("detalle_justificacion", "Justificacion")}
                </Typography>
              </Box>
              <Typography variant="body2">{solicitud.justificacion}</Typography>
            </Paper>
          )}

          {/* Items / Materiales */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <InventoryIcon sx={{ color: "primary.main" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t("detalle_items", "Materiales")} ({items.length})
              </Typography>
            </Box>

            {items.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>
                        {t("item_codigo", "Codigo SAP")}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>
                        {t("item_descripcion", "Descripcion")}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>
                        {t("item_cantidad", "Cant.")}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>
                        {t("item_precio", "Precio")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "primary.main" }}>
                          {item.codigo || item.codigo_sap || item.material_id || "-"}
                        </TableCell>
                        <TableCell>
                          {item.descripcion || item.nombre || "-"}
                        </TableCell>
                        <TableCell align="right">
                          {item.cantidad || 0} {item.unidad || ""}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                          {formatCurrency(item.precio_unitario || item.precio || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell colSpan={3} align="right" sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>
                        {t("detalle_total", "Total")}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700, color: "primary.main" }}>
                        {formatCurrency(solicitud.total_monto || 0)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                {t("detalle_sin_items", "Sin materiales")}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          bgcolor: "grey.50",
          border: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", color: "text.secondary" }}>
          {label}
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          {typeof value === "string" || typeof value === "number" ? (
            <Typography variant="body2">{value || "-"}</Typography>
          ) : (
            value || "-"
          )}
        </Box>
      </Box>
    </Box>
  );
}

InfoItem.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
};

SolicitudDetalleModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  solicitud: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    id_usuario: PropTypes.string,
    solicitante_nombre: PropTypes.string,
    solicitante_apellido: PropTypes.string,
    nombre: PropTypes.string,
    apellido: PropTypes.string,
    centro: PropTypes.string,
    sector: PropTypes.string,
    criticidad: PropTypes.string,
    justificacion: PropTypes.string,
    fecha_necesidad: PropTypes.string,
    created_at: PropTypes.string,
    total_monto: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    items: PropTypes.arrayOf(PropTypes.object),
  }),
};
