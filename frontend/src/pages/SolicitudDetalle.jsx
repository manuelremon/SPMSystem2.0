import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { solicitudes } from "../services/spm";
import { useI18n } from "../context/i18n";
import { Card, CardHeader, CardContent, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { PageHeader } from "../components/ui/PageHeader";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import StatusBadge from "../components/ui/StatusBadge";
import { formatDate, formatCurrency, getSectorNombre, formatAlmacen } from "../utils/formatters";
import {
  ArrowLeft,
  Calendar,
  Building2,
  MapPin,
  FileText,
  Package,
  DollarSign,
  AlertTriangle,
  Clock,
  User,
  Hash,
} from "lucide-react";

function DetailRow({ icon: Icon, label, value, className = "" }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[var(--fg-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-[var(--fg)] mt-0.5 break-words">{value || "-"}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-[var(--bg-soft)] rounded w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 bg-[var(--bg-soft)] rounded-xl"></div>
        <div className="h-48 bg-[var(--bg-soft)] rounded-xl"></div>
      </div>
      <div className="h-64 bg-[var(--bg-soft)] rounded-xl"></div>
    </div>
  );
}

export default function SolicitudDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSolicitud = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await solicitudes.obtener(id);
        if (res.data?.solicitud) {
          setSolicitud(res.data.solicitud);
        } else if (res.data) {
          setSolicitud(res.data);
        } else {
          setError("No se encontró la solicitud");
        }
      } catch (err) {
        console.error("Error fetching solicitud:", err);
        setError(err.response?.data?.error?.message || err.message || "Error al cargar la solicitud");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSolicitud();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("detalle_loading", "Cargando solicitud...")}
          actions={
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common_back", "Volver")}
            </Button>
          }
        />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("detalle_error_title", "Error")}
          actions={
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common_back", "Volver")}
            </Button>
          }
        />
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  if (!solicitud) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("detalle_not_found", "Solicitud no encontrada")}
          actions={
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common_back", "Volver")}
            </Button>
          }
        />
        <Alert variant="warning">{t("detalle_not_found_msg", "La solicitud solicitada no existe o fue eliminada.")}</Alert>
      </div>
    );
  }

  const items = solicitud.items || [];
  const estado = solicitud.estado || solicitud.status || "pendiente";
  const criticidad = solicitud.criticidad || "Normal";
  const isAltaCriticidad = criticidad.toLowerCase().includes("alta");

  return (
    <div className="space-y-6">
      {/* Header */}
      <ScrollReveal>
        <PageHeader
          title={`${t("detalle_title", "Solicitud")} #${solicitud.id}`}
          actions={
            <div className="flex items-center gap-3">
              <StatusBadge estado={estado} />
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("common_back", "Volver")}
              </Button>
            </div>
          }
        />
      </ScrollReveal>

      {/* Info Cards */}
      <ScrollReveal delay={100}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detalle_info_general", "Información General")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow
              icon={Hash}
              label={t("detalle_id", "ID de Solicitud")}
              value={solicitud.id}
            />
            <DetailRow
              icon={User}
              label={t("detalle_solicitante", "Solicitante")}
              value={solicitud.id_usuario || solicitud.solicitante}
            />
            <DetailRow
              icon={Calendar}
              label={t("detalle_fecha_creacion", "Fecha de Creación")}
              value={formatDate(solicitud.created_at || solicitud.fecha_creacion)}
            />
            <DetailRow
              icon={Clock}
              label={t("detalle_fecha_necesidad", "Fecha de Necesidad")}
              value={formatDate(solicitud.fecha_necesidad)}
            />
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center flex-shrink-0">
                <AlertTriangle className={`w-4 h-4 ${isAltaCriticidad ? "text-[var(--danger)]" : "text-[var(--fg-muted)]"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  {t("detalle_criticidad", "Criticidad")}
                </p>
                <Badge
                  variant={isAltaCriticidad ? "danger" : "default"}
                  className="mt-1 uppercase text-xs font-semibold"
                >
                  {criticidad}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ubicación y Costos */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detalle_ubicacion", "Ubicación y Costos")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow
              icon={Building2}
              label={t("detalle_centro", "Centro")}
              value={solicitud.centro || solicitud.centro_id}
            />
            <DetailRow
              icon={MapPin}
              label={t("detalle_sector", "Sector")}
              value={getSectorNombre(solicitud.sector || solicitud.sector_id)}
            />
            <DetailRow
              icon={Package}
              label={t("detalle_almacen", "Almacén Virtual")}
              value={formatAlmacen(solicitud.almacen_virtual || solicitud.almacen)}
            />
            <DetailRow
              icon={DollarSign}
              label={t("detalle_centro_costos", "Centro de Costos")}
              value={solicitud.centro_costos}
            />
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--primary-muted)]/20 border border-[var(--primary)]/30 grid place-items-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  {t("detalle_monto_total", "Monto Total")}
                </p>
                <p className="text-lg font-bold text-[var(--primary)] mt-0.5">
                  {formatCurrency(solicitud.total_monto || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </ScrollReveal>

      {/* Justificación */}
      <ScrollReveal delay={200}>
        <Card>
        <CardHeader>
          <CardTitle>{t("detalle_justificacion", "Justificación")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center flex-shrink-0">
              <FileText className="w-4 h-4 text-[var(--fg-muted)]" />
            </div>
            <p className="text-sm text-[var(--fg)] leading-relaxed flex-1">
              {solicitud.justificacion || t("detalle_sin_justificacion", "Sin justificación proporcionada")}
            </p>
          </div>
        </CardContent>
        </Card>
      </ScrollReveal>

      {/* Items/Materiales */}
      <ScrollReveal delay={300}>
        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {t("detalle_materiales", "Materiales")} ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-[var(--fg-muted)]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t("detalle_sin_items", "No hay materiales en esta solicitud")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--fg-muted)]">
                      {t("detalle_item_codigo", "Código")}
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--fg-muted)]">
                      {t("detalle_item_descripcion", "Descripción")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--fg-muted)]">
                      {t("detalle_item_cantidad", "Cantidad")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--fg-muted)]">
                      {t("detalle_item_precio", "Precio Unit.")}
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--fg-muted)]">
                      {t("detalle_item_subtotal", "Subtotal")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const precio = Number(item.precio_unitario || item.precio || 0);
                    const cantidad = Number(item.cantidad || 0);
                    const subtotal = precio * cantidad;
                    return (
                      <tr
                        key={idx}
                        className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-[var(--fg)]">
                          {item.codigo || item.material_codigo || "-"}
                        </td>
                        <td className="py-3 px-4 text-[var(--fg)]">
                          <div className="max-w-xs">
                            <p className="truncate" title={item.descripcion || item.material_descripcion}>
                              {item.descripcion || item.material_descripcion || "-"}
                            </p>
                            {item.comentario && (
                              <p className="text-xs text-[var(--fg-muted)] mt-1 truncate" title={item.comentario}>
                                {item.comentario}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[var(--fg)]">
                          {cantidad} {item.unidad || ""}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[var(--fg-muted)]">
                          {formatCurrency(precio)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[var(--fg)]">
                          {formatCurrency(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--bg-elevated)]">
                    <td colSpan={4} className="py-3 px-4 text-right font-semibold text-[var(--fg)]">
                      {t("detalle_total", "Total")}:
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-lg text-[var(--primary)]">
                      {formatCurrency(solicitud.total_monto || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
        </Card>
      </ScrollReveal>

      {/* Acciones según estado */}
      {estado.toLowerCase() === "borrador" && (
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(`/solicitudes/${solicitud.id}/materiales`)}
          >
            {t("detalle_btn_editar", "Editar Solicitud")}
          </Button>
        </div>
      )}
    </div>
  );
}
