/**
 * SolicitudDetalleModal - Modal para ver detalles de solicitud en Planner
 * Muestra información resumida sin navegar a otra página
 */

import PropTypes from "prop-types";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { useI18n } from "../../context/i18n";
import { formatDate, formatCurrency, getSectorNombre } from "../../utils/formatters";
import {
  User,
  Calendar,
  Building2,
  MapPin,
  Package,
  AlertTriangle,
  FileText,
  ICON_COLORS,
} from "../ui/Icons";

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t("detalle_title", "Solicitud")} #${solicitud.id}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Info General */}
        <div className="grid grid-cols-2 gap-4">
          <InfoItem
            icon={<User className={`w-4 h-4 ${ICON_COLORS.info}`} />}
            label={t("detalle_solicitante", "Solicitante")}
            value={solicitanteNombre}
          />
          <InfoItem
            icon={<Calendar className={`w-4 h-4 ${ICON_COLORS.time}`} />}
            label={t("detalle_fecha_creacion", "Fecha Creación")}
            value={formatDate(solicitud.created_at)}
          />
          <InfoItem
            icon={<Building2 className={`w-4 h-4 ${ICON_COLORS.info}`} />}
            label={t("detalle_centro", "Centro")}
            value={solicitud.centro}
          />
          <InfoItem
            icon={<MapPin className={`w-4 h-4 ${ICON_COLORS.info}`} />}
            label={t("detalle_sector", "Sector")}
            value={getSectorNombre(solicitud.sector)}
          />
          <InfoItem
            icon={<Calendar className={`w-4 h-4 ${ICON_COLORS.warning}`} />}
            label={t("detalle_fecha_necesidad", "Fecha Necesidad")}
            value={formatDate(solicitud.fecha_necesidad)}
          />
          <InfoItem
            icon={<AlertTriangle className={`w-4 h-4 ${isAltaCriticidad ? ICON_COLORS.danger : ICON_COLORS.info}`} />}
            label={t("detalle_criticidad", "Criticidad")}
            value={
              <Badge variant={isAltaCriticidad ? "danger" : "default"} className="text-xs">
                {criticidad}
              </Badge>
            }
          />
        </div>

        {/* Justificación */}
        {solicitud.justificacion && (
          <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-2">
              <FileText className={`w-4 h-4 ${ICON_COLORS.info}`} />
              <span className="text-xs font-medium text-[var(--fg-muted)] uppercase">
                {t("detalle_justificacion", "Justificación")}
              </span>
            </div>
            <p className="text-sm text-[var(--fg)]">{solicitud.justificacion}</p>
          </div>
        )}

        {/* Items / Materiales */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className={`w-4 h-4 ${ICON_COLORS.primary}`} />
            <span className="text-sm font-medium text-[var(--fg)]">
              {t("detalle_items", "Materiales")} ({items.length})
            </span>
          </div>

          {items.length > 0 ? (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-soft)]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--fg-muted)] uppercase">
                      {t("item_codigo", "Código SAP")}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--fg-muted)] uppercase">
                      {t("item_descripcion", "Descripción")}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-[var(--fg-muted)] uppercase">
                      {t("item_cantidad", "Cant.")}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-[var(--fg-muted)] uppercase">
                      {t("item_precio", "Precio")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-soft)]/50">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--primary)]">
                        {item.codigo || item.codigo_sap || item.material_id || "-"}
                      </td>
                      <td className="px-3 py-2 text-[var(--fg)]">
                        {item.descripcion || item.nombre || "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--fg)]">
                        {item.cantidad || 0} {item.unidad || ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--fg)]">
                        {formatCurrency(item.precio_unitario || item.precio || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--bg-soft)]">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right text-xs font-medium text-[var(--fg-muted)] uppercase">
                      {t("detalle_total", "Total")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-[var(--primary)]">
                      {formatCurrency(solicitud.total_monto || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-muted)] text-center py-4">
              {t("detalle_sin_items", "Sin materiales")}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--fg-muted)] uppercase">{label}</p>
        <div className="text-sm text-[var(--fg)] mt-0.5">{value || "-"}</div>
      </div>
    </div>
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
