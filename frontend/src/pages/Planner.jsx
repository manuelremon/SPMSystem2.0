/**
 * Planner Page
 * Refactored to use usePlanner hook for state management
 * Sprint: Technical Audit - Phase 2
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanner, renderSolicitante } from "../hooks/usePlanner";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardDescription, CardContent } from "../components/ui/Card";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { withSpmAlignments } from "../utils/tableAlignments";
import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { TableSkeleton } from "../components/ui/Skeleton";
import TratarSolicitudModal from "../components/Planner/TratarSolicitudModal";
import { Modal } from "../components/ui/Modal";
import { useI18n } from "../context/i18n";
import {
  RefreshCcw,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Eye,
  Play,
  Info,
  ICON_COLORS,
} from "../components/ui/Icons";
import { formatDate, formatCurrency, getSectorNombre } from "../utils/formatters";
import { getCriticidadConfig, getEstadoConfig } from "../utils/styleConfig";

export default function Planner() {
  const { t } = useI18n();
  const navigate = useNavigate();

  // All state and logic extracted to usePlanner hook
  const {
    error,
    success,
    loading,
    q,
    filtroCentro,
    filtroSector,
    filtroEstado,
    filtroCriticidad,
    currentPage,
    activeTab,
    selectedParaTratar,
    rejectModal,
    historialModal,
    filtered,
    paginatedItems,
    totalPages,
    tabCounts,
    itemsPerPage,
    setQ,
    setFiltroCentro,
    setFiltroSector,
    setFiltroEstado,
    setFiltroCriticidad,
    setCurrentPage,
    setActiveTab,
    load,
    handleTratar,
    rechazar,
    handleExport,
    closeTratarModal,
    onTratarComplete,
    closeRejectModal,
    updateRejectMotivo,
    openHistorialModal,
    closeHistorialModal,
    clearError,
    clearSuccess,
  } = usePlanner({ t });

  // Column definitions with SPM alignments
  const columns = useCallback(() => withSpmAlignments([
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id || 0)
    },
    {
      key: "acciones",
      header: t("planner_accion", "ACCIÓN"),
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            className="p-1.5 rounded-md hover:bg-blue-500/10 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/solicitudes/${row.id}`);
            }}
            type="button"
            title={t("planner_ver_tooltip", "Ver detalles")}
          >
            <Eye className={`w-4 h-4 ${ICON_COLORS.info}`} />
          </button>
          <button
            className="px-2 py-1 rounded-md hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              handleTratar(row);
            }}
            type="button"
            title={t("planner_tratar_tooltip", "Tratar solicitud")}
          >
            <Play className={`w-4 h-4 ${ICON_COLORS.success}`} />
            <span className="text-xs font-medium text-emerald-600">{t("planner_tratar", "Tratar")}</span>
          </button>
        </div>
      ),
    },
    {
      key: "created_at",
      header: t("planner_fecha_creacion", "F. Creación"),
      render: (row) => formatDate(row.created_at),
      sortAccessor: (row) => new Date(row.created_at || 0).getTime() || 0,
    },
    {
      key: "centro",
      header: t("planner_centro", "Centro"),
      sortAccessor: (row) => row.centro || ""
    },
    {
      key: "sector",
      header: t("planner_sector", "Sector"),
      render: (row) => getSectorNombre(row.sector),
      sortAccessor: (row) => getSectorNombre(row.sector),
    },
    {
      key: "solicitante",
      header: t("dash_table_solicitante", "Solicitante"),
      render: (row) => renderSolicitante(row),
      sortAccessor: (row) => renderSolicitante(row),
    },
    {
      key: "criticidad",
      header: t("planner_criticidad", "Criticidad"),
      render: (row) => {
        const criticidad = row.criticidad || "Normal";
        const config = getCriticidadConfig(criticidad);
        const Icon = config.icon;
        return (
          <div className="inline-flex items-center gap-1.5">
            {Icon && (
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: config.color }}
              />
            )}
            <span
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: config.color }}
            >
              {config.label}
            </span>
          </div>
        );
      },
      sortAccessor: (row) => row.criticidad || "Normal",
    },
    {
      key: "justificacion",
      header: t("planner_justificacion", "Asunto"),
      render: (row) => {
        const text = row.justificacion || "";
        const isTruncated = text.length > 10;
        const truncated = isTruncated ? text.substring(0, 10) + "..." : text;
        return isTruncated ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alert(text);
            }}
            className="text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            title={t("planner_ver_completo", "Click para ver completo")}
          >
            {truncated}
          </button>
        ) : (
          <span>{text}</span>
        );
      },
      sortAccessor: (row) => (row.justificacion || "").toString(),
    },
    {
      key: "total_monto",
      header: t("planner_monto", "Monto"),
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-sm text-slate-800">
          {formatCurrency(row.total_monto || 0)}
        </span>
      ),
      sortAccessor: (row) => Number(row.total_monto || 0),
    },
    {
      key: "fecha_necesidad",
      header: t("planner_fecha", "F. Necesidad"),
      render: (row) => formatDate(row.fecha_necesidad),
      sortAccessor: (row) => new Date(row.fecha_necesidad || 0).getTime() || 0,
    },
    {
      key: "estado",
      header: t("planner_estado", "Estado"),
      render: (row) => {
        const estadoVal = row.status || row.estado || "Aprobada";
        const config = getEstadoConfig(estadoVal);
        return (
          <button
            onClick={() => openHistorialModal(row)}
            className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: config.color }}
            title={t("planner_ver_historial", "Ver historial de estados")}
            type="button"
          >
            {config.icon}
            <span className="text-xs font-semibold tracking-wide uppercase">{config.label}</span>
            <Info className={`w-3 h-3 opacity-50 ${ICON_COLORS.info}`} />
          </button>
        );
      },
      sortAccessor: (row) => (row.status || row.estado || "").toString(),
    },
  ]), [t, navigate, handleTratar, openHistorialModal]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="PLANIFICADOR" />

      {/* Success/Error Messages */}
      {success && (
        <Alert variant="success" onDismiss={clearSuccess} className="animate-in fade-in duration-200">
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" onDismiss={clearError} className="animate-in fade-in duration-200">
          {error}
        </Alert>
      )}

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* General Search */}
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <label htmlFor="planner-search" className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
              {t("planner_busqueda_general", "Buscar")}
            </label>
            <Input
              id="planner-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("planner_buscar_placeholder", "ID, asunto, solicitante...")}
              aria-label={t("planner_busqueda_general", "Búsqueda general")}
            />
          </div>

          {/* Centro Filter */}
          <div className="w-[130px]">
            <label htmlFor="planner-centro" className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
              {t("planner_centro", "Centro")}
            </label>
            <Select
              id="planner-centro"
              value={filtroCentro}
              onChange={(e) => setFiltroCentro(e.target.value)}
              aria-label={t("planner_centro", "Centro")}
            >
              <option value="">{t("planner_todos", "Todos")}</option>
              <option value="1008">1008</option>
              <option value="1064">1064</option>
              <option value="1070">1070</option>
            </Select>
          </div>

          {/* Sector Filter */}
          <div className="w-[160px]">
            <label htmlFor="planner-sector" className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
              {t("planner_sector", "Sector")}
            </label>
            <Select
              id="planner-sector"
              value={filtroSector}
              onChange={(e) => setFiltroSector(e.target.value)}
              aria-label={t("planner_sector", "Sector")}
            >
              <option value="">{t("planner_todos", "Todos")}</option>
              <option value="Almacenes">{t("planner_sector_almacenes", "Almacenes")}</option>
              <option value="Compras">{t("planner_sector_compras", "Compras")}</option>
              <option value="Mantenimiento">{t("planner_sector_mantenimiento", "Mantenimiento")}</option>
              <option value="Planificación">{t("planner_sector_planificacion", "Planificación")}</option>
              <option value="Operaciones">{t("planner_sector_operaciones", "Operaciones")}</option>
              <option value="Logística">{t("planner_sector_logistica", "Logística")}</option>
              <option value="Producción">{t("planner_sector_produccion", "Producción")}</option>
              <option value="Calidad">{t("planner_sector_calidad", "Calidad")}</option>
            </Select>
          </div>

          {/* Estado Filter */}
          <div className="w-[140px]">
            <label htmlFor="planner-estado" className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
              {t("planner_estado", "Estado")}
            </label>
            <Select
              id="planner-estado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              aria-label={t("planner_estado", "Estado")}
            >
              <option value="">{t("planner_todos", "Todos")}</option>
              <option value="aprobada">{t("planner_estado_aprobada", "Aprobada")}</option>
              <option value="progreso">{t("planner_estado_progreso", "En Progreso")}</option>
              <option value="finalizada">{t("planner_estado_finalizada", "Finalizada")}</option>
              <option value="rechazada">{t("planner_estado_rechazada", "Rechazada")}</option>
            </Select>
          </div>

          {/* Criticidad Filter */}
          <div className="w-[120px]">
            <label htmlFor="planner-criticidad" className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
              {t("planner_criticidad", "Criticidad")}
            </label>
            <Select
              id="planner-criticidad"
              value={filtroCriticidad}
              onChange={(e) => setFiltroCriticidad(e.target.value)}
              aria-label={t("planner_criticidad", "Criticidad")}
            >
              <option value="">{t("planner_todas", "Todas")}</option>
              <option value="normal">{t("planner_criticidad_normal", "Normal")}</option>
              <option value="alta">{t("planner_criticidad_alta", "Alta")}</option>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              onClick={load}
              disabled={loading}
              type="button"
              aria-label={loading ? t("planner_actualizando", "Actualizando...") : t("planner_actualizar", "Actualizar")}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              {t("planner_actualizar", "Actualizar")}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExport}
              type="button"
              disabled={filtered.length === 0}
              aria-label={t("planner_exportar_xls", "Exportar XLS")}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {t("planner_exportar_xls", "Exportar")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Solicitudes Table */}
      <Card>
        {/* Status Tabs */}
        <div className="px-6 pt-4">
          <div className="flex border-b border-slate-200">
            <TabButton
              active={activeTab === "pendientes"}
              onClick={() => setActiveTab("pendientes")}
              icon={<Clock className={`w-4 h-4 ${ICON_COLORS.time}`} />}
              label={t("planner_tab_pendientes", "Pendientes")}
              count={tabCounts.pendientes}
              countColor="bg-amber-500"
              activeColor="text-amber-600"
              borderColor="bg-amber-600"
            />
            <TabButton
              active={activeTab === "en_progreso"}
              onClick={() => setActiveTab("en_progreso")}
              icon={<Play className={`w-4 h-4 ${ICON_COLORS.primary}`} />}
              label={t("planner_tab_en_progreso", "En Progreso")}
              count={tabCounts.en_progreso}
              countColor="bg-blue-500"
              activeColor="text-blue-600"
              borderColor="bg-blue-600"
            />
            <TabButton
              active={activeTab === "finalizadas"}
              onClick={() => setActiveTab("finalizadas")}
              icon={<CheckCircle className={`w-4 h-4 ${ICON_COLORS.success}`} />}
              label={t("planner_tab_finalizadas", "Finalizadas")}
              count={tabCounts.finalizadas}
              countColor="bg-slate-100 text-slate-500"
              activeColor="text-emerald-600"
              borderColor="bg-emerald-600"
            />
          </div>
        </div>

        <CardHeader className="px-6 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>
              {filtered.length} {filtered.length === 1 ? t("planner_solicitud", "solicitud") : t("planner_solicitudes", "solicitudes")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0 pt-0">
          {loading ? (
            <TableSkeleton rows={5} columns={10} />
          ) : (
            <DataTable
              columns={columns()}
              rows={paginatedItems}
              emptyMessage={t("planner_empty_full", "Sin solicitudes asignadas")}
            />
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            labels={{
              page: t("common_pagina", "Página"),
              of: t("common_de", "de"),
              showing: t("common_mostrando", "Mostrando"),
              prev: t("common_anterior", "Anterior"),
              next: t("common_siguiente", "Siguiente"),
            }}
          />
        </CardContent>
      </Card>

      {/* Treatment Modal */}
      <TratarSolicitudModal
        solicitud={selectedParaTratar}
        isOpen={!!selectedParaTratar}
        onClose={closeTratarModal}
        onComplete={onTratarComplete}
      />

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={closeRejectModal}
        title={`${t("planner_rechazar_solicitud", "Rechazar Solicitud")} #${rejectModal.solicitud?.id}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeRejectModal} type="button">
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button onClick={rechazar} type="button">
              {t("planner_confirmar_rechazo", "Confirmar Rechazo")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            {t("planner_rechazar_motivo_label", "Motivo del rechazo")} <span className="text-red-600">*</span>
          </p>
          <textarea
            value={rejectModal.motivo}
            onChange={(e) => updateRejectMotivo(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-blue-300 ring-1 ring-blue-100 bg-white/50 text-sm text-slate-800 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all"
            placeholder={t("planner_rechazar_placeholder", "Explica brevemente el motivo del rechazo...")}
          />
        </div>
      </Modal>

      {/* Historial Modal */}
      <HistorialModal
        isOpen={historialModal.open}
        onClose={closeHistorialModal}
        solicitud={historialModal.solicitud}
        t={t}
      />
    </div>
  );
}

/**
 * Tab Button Component
 */
function TabButton({ active, onClick, icon, label, count, countColor, activeColor, borderColor }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
        active ? activeColor : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
        {count > 0 && (
          <span className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold rounded-full ${
            countColor.includes("text-") ? countColor : `text-white ${countColor}`
          }`}>
            {count}
          </span>
        )}
      </span>
      {active && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${borderColor}`} />}
    </button>
  );
}

/**
 * Historial Modal Component
 */
function HistorialModal({ isOpen, onClose, solicitud, t }) {
  if (!solicitud) return null;

  const estadoVal = solicitud.status || solicitud.estado || "Pendiente";
  const config = getEstadoConfig(estadoVal);
  const estadoLower = estadoVal.toLowerCase();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t("planner_historial_titulo", "Historial de Estados")} - Solicitud #${solicitud?.id}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Current State */}
        <div className="p-4 rounded-lg bg-slate-50/70 border border-white/30">
          <h4 className="text-xs uppercase font-bold tracking-[0.08em] text-slate-500 mb-2">
            {t("planner_historial_estado_actual", "Estado Actual")}
          </h4>
          <div className="flex items-center gap-2" style={{ color: config.color }}>
            {config.icon}
            <span className="text-lg font-semibold">{config.label}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {/* Creation */}
          <TimelineItem
            icon={<Clock className={`w-4 h-4 ${ICON_COLORS.info}`} />}
            iconBg="bg-blue-500/20"
            title={t("planner_historial_creada", "Solicitud Creada")}
            subtitle={`${formatDate(solicitud.created_at)}${
              solicitud.solicitante_nombre ? ` • ${solicitud.solicitante_nombre} ${solicitud.solicitante_apellido || ""}` : ""
            }`}
          />

          {/* Approval */}
          {estadoLower.includes("aprobad") && (
            <TimelineItem
              icon={<CheckCircle className={`w-4 h-4 ${ICON_COLORS.success}`} />}
              iconBg="bg-emerald-500/20"
              title={t("planner_historial_aprobada", "Aprobada por Coordinador")}
              subtitle={`${solicitud.aprobado_at ? formatDate(solicitud.aprobado_at) : t("planner_historial_fecha_no_disponible", "Fecha no disponible")}${
                solicitud.aprobador_nombre ? ` • ${solicitud.aprobador_nombre} ${solicitud.aprobador_apellido || ""}` : ""
              }`}
            />
          )}

          {/* Assigned to Planner */}
          {solicitud.planner_nombre && (
            <TimelineItem
              icon={<Play className={`w-4 h-4 ${ICON_COLORS.primary}`} />}
              iconBg="bg-blue-600/20"
              title={t("planner_historial_asignada", "Asignada a Planificador")}
              subtitle={`${solicitud.planner_nombre} ${solicitud.planner_apellido || ""}`}
            />
          )}

          {/* In Progress */}
          {estadoLower.includes("progreso") && (
            <TimelineItem
              icon={<Clock className={`w-4 h-4 ${ICON_COLORS.info}`} />}
              iconBg="bg-blue-500/20"
              title={t("planner_historial_en_progreso", "En Progreso")}
              subtitle={t("planner_historial_tratamiento", "En tratamiento por el planificador")}
            />
          )}

          {/* Rejected */}
          {estadoLower.includes("rechaz") && (
            <TimelineItem
              icon={<XCircle className={`w-4 h-4 ${ICON_COLORS.danger}`} />}
              iconBg="bg-red-500/20"
              title={t("planner_historial_rechazada", "Rechazada")}
              subtitle={solicitud.motivo_rechazo ? `${t("planner_historial_motivo", "Motivo")}: ${solicitud.motivo_rechazo}` : undefined}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Timeline Item Component
 */
function TimelineItem({ icon, iconBg, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 border border-white/30">
      <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
