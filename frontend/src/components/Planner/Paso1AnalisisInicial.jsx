import React, { useState } from "react";
import api from "../../services/api";
import { ensureCsrfToken } from "../../services/csrf";
import { formatCurrency } from "../../utils/formatters";
import { SPMAgGrid } from "../ui/SPMAgGrid";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";

export default function Paso1AnalisisInicial({ analisis = {}, solicitud = {}, onNext, onReject, onRequestInfo }) {
  const resumen = analisis.resumen || {};
  const conflictos = analisis.conflictos || [];
  const avisos = analisis.avisos || [];
  const recomendaciones = analisis.recomendaciones || [];
  const materiales = analisis.materiales_por_criticidad || {};
  const [showPresupuestoModal, setShowPresupuestoModal] = useState(false);

  const tieneConflictosCriticos = conflictos.some(c => c.impacto_critico);
  const tieneConflictos = conflictos.length > 0;

  return (
    <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2 }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: "1px solid var(--border)" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "var(--fg-strong)" }}>
          Análisis Inicial
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
          {/* Columna izquierda */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <PresupuestoCard
              resumen={resumen}
              solicitud={solicitud}
              onPresupuestoInsuficiente={() => setShowPresupuestoModal(true)}
            />

            {/* Conflictos, Avisos y Recomendaciones */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
              <AlertCard
                title="CONFLICTOS"
                count={conflictos.length}
                emptyLabel="Sin conflictos"
                items={conflictos.map((c) => ({
                  label: c.tipo,
                  detail: c.descripcion || `Item ${c.item_idx}`,
                  critical: c.impacto_critico,
                }))}
                variant="error"
              />
              <AlertCard
                title="AVISOS"
                count={avisos.length}
                emptyLabel="Sin avisos"
                items={avisos.map((a) => ({
                  label: a.nivel || "info",
                  detail: a.mensaje || "",
                }))}
                variant="warning"
              />
              <AlertCard
                title="RECOMENDACIONES"
                count={recomendaciones.length}
                emptyLabel="Sin recomendaciones"
                items={recomendaciones.map((r) => ({
                  label: r.accion,
                  detail: r.razon,
                }))}
                variant="info"
              />
            </Box>
          </Box>

          {/* Columna derecha: Materiales */}
          <MaterialesList materiales={materiales} solicitud={solicitud} />
        </Box>

        {/* Acciones especiales */}
        {(tieneConflictosCriticos || tieneConflictos) && (
          <Box sx={{ display: "flex", gap: 1, pt: 3, mt: 3, borderTop: "1px solid var(--border)" }}>
            {tieneConflictosCriticos && onReject && (
              <Button variant="outlined" color="error" onClick={onReject} size="small">
                Rechazar solicitud
              </Button>
            )}
            {tieneConflictos && onRequestInfo && (
              <Button variant="text" sx={{ color: "var(--fg-muted)" }} onClick={onRequestInfo} size="small">
                Solicitar información
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Modal */}
      <PresupuestoInsuficienteModal
        solicitud={solicitud}
        isOpen={showPresupuestoModal}
        onClose={() => setShowPresupuestoModal(false)}
      />
    </Paper>
  );
}

function PresupuestoCard({ resumen, solicitud, onPresupuestoInsuficiente }) {
  const disponible = resumen.presupuesto_disponible || 0;
  const items = solicitud.items || solicitud.data_json?.items || [];
  const costoCalculado = items.reduce((total, item) => {
    const precio = Number(item.precio_unitario || item.precio_usd || 0);
    const cantidad = Number(item.cantidad || 0);
    return total + (precio * cantidad);
  }, 0);
  const costoTotal = costoCalculado > 0 ? costoCalculado : (resumen.presupuesto_real_necesario || 0);
  const diferencia = disponible - costoTotal;
  const alcanza = diferencia >= 0;

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)", borderRadius: 2 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, letterSpacing: 0.5, color: "var(--fg-muted)", textTransform: "uppercase", display: "block", mb: 2 }}
      >
        BALANCE PRESUPUESTO
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>Presupuesto Disponible</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--fg-strong)" }}>{formatCurrency(disponible)}</Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>Costo de la Solicitud</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--fg-strong)" }}>{formatCurrency(costoTotal)}</Typography>
        </Box>

        <Paper
          elevation={0}
          onClick={() => !alcanza && onPresupuestoInsuficiente?.()}
          sx={{
            p: 1.5,
            mt: 1,
            border: 2,
            borderColor: alcanza ? "var(--success)" : "var(--danger)",
            borderRadius: 1,
            bgcolor: alcanza ? "var(--success-bg)" : "var(--danger-bg)",
            cursor: alcanza ? "default" : "pointer",
            "&:hover": !alcanza ? { bgcolor: "rgba(239, 68, 68, 0.1)" } : {},
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>Balance</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: alcanza ? "var(--success)" : "var(--danger)" }}>
              {diferencia >= 0 ? '+' : ''}{formatCurrency(diferencia)} {alcanza ? '✓' : ''}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Paper>
  );
}

function AlertCard({ title, count, emptyLabel, items, variant }) {
  const [expanded, setExpanded] = useState(false);

  const colors = {
    error: { bg: "var(--danger-bg)", border: "var(--danger-border)", badge: "var(--danger)" },
    warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", badge: "var(--warning)" },
    info: { bg: "var(--info-bg)", border: "var(--info-border)", badge: "var(--info)" },
  };
  const c = colors[variant] || colors.info;

  return (
    <Paper
      elevation={0}
      sx={{ p: 1.5, bgcolor: c.bg, border: `1px solid ${c.border}`, borderRadius: 1.5 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--fg)", letterSpacing: 0.3, fontSize: "0.65rem" }}>
          {title}
        </Typography>
        <Chip
          label={count}
          size="small"
          sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: c.badge, color: "#fff" }}
        />
      </Box>

      {count === 0 ? (
        <Typography variant="caption" sx={{ color: "var(--fg-muted)", fontSize: "0.7rem" }}>{emptyLabel}</Typography>
      ) : (
        <>
          <Box sx={{ maxHeight: expanded ? 150 : 60, overflow: "auto" }}>
            {(expanded ? items : items.slice(0, 2)).map((it, idx) => (
              <Box key={idx} sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--fg)", display: "block", fontSize: "0.65rem" }}>
                  {it.critical && "⚠ "}{it.label}
                </Typography>
                {it.detail && (
                  <Typography
                    variant="caption"
                    sx={{ color: "var(--fg-muted)", display: "block", fontSize: "0.6rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {it.detail}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
          {items.length > 2 && (
            <Typography
              variant="caption"
              onClick={() => setExpanded(!expanded)}
              sx={{ color: "var(--primary)", cursor: "pointer", fontSize: "0.6rem", fontWeight: 600, mt: 0.5, display: "block" }}
            >
              {expanded ? "Ver menos" : `+${items.length - 2} más`}
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
}

function MaterialesList({ materiales, solicitud }) {
  const todosLosMateriales = [
    ...(materiales.Critico || []),
    ...(materiales.Normal || []),
    ...(materiales.Bajo || []),
  ];

  const items = todosLosMateriales.length > 0
    ? todosLosMateriales
    : (solicitud.items || solicitud.data_json?.items || []).map((item, idx) => ({
        id: idx,
        codigo: item.codigo || item.material || item.material_id || "",
        descripcion: item.descripcion || "Sin descripción",
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario || item.precio_usd || 0,
      }));

  // Asegurar que cada item tenga un id único
  const rows = items.map((item, idx) => ({
    id: item.id ?? item.idx ?? idx,
    codigo: item.codigo || "",
    descripcion: item.descripcion || "",
    cantidad: item.cantidad || 0,
    precio_unitario: item.precio_unitario || 0,
  }));

  const columnDefs = [
    {
      field: "codigo",
      headerName: "Código",
      flex: 0.8,
      minWidth: 100,
    },
    {
      field: "descripcion",
      headerName: "Descripción",
      flex: 1.5,
      minWidth: 150,
    },
    {
      field: "cantidad",
      headerName: "Cant.",
      flex: 0.4,
      minWidth: 60,
      cellRenderer: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{params.value}</Typography>
      ),
    },
    {
      field: "precio_unitario",
      headerName: "P. Unit.",
      flex: 0.6,
      minWidth: 90,
      type: "numericColumn",
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      cellRenderer: (params) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {formatCurrency(params.value || 0)}
        </Typography>
      ),
    },
  ];

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)", borderRadius: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: 0.5, color: "var(--fg-muted)", textTransform: "uppercase" }}
        >
          MATERIALES SOLICITADOS
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--fg-strong)" }}>
          {items.length} items
        </Typography>
      </Box>

      {items.length === 0 ? (
        <Typography variant="body2" sx={{ color: "var(--fg-muted)", textAlign: "center", py: 4 }}>
          Sin materiales en la solicitud
        </Typography>
      ) : (
        <SPMAgGrid
          rowData={rows}
          columnDefs={columnDefs}
          height={350}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[5, 10, 25]}
          emptyMessage="Sin materiales"
        />
      )}
    </Paper>
  );
}

function PresupuestoInsuficienteModal({ solicitud, isOpen, onClose }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const sectorMap = {
    "1": "Almacenes", "2": "Compras", "3": "Mantenimiento", "4": "Planificación",
    "5": "Operaciones", "6": "Logística", "7": "Producción", "8": "Calidad",
  };
  const sectorNombre = solicitud.sector_nombre || sectorMap[solicitud.sector] || solicitud.sector;
  const nombreCompleto = `${solicitud.solicitante_nombre || ""} ${solicitud.solicitante_apellido || ""}`.trim() || solicitud.id_usuario;
  const mensajeDefault = `La solicitud #${solicitud.id} no podrá ser procesada hasta tanto no se incorpore saldo al Centro ${solicitud.centro} Sector "${sectorNombre}".`;

  const handleEnviar = async () => {
    setSending(true);
    setError("");
    try {
      await ensureCsrfToken();
      await api.post("/mensajes", {
        destinatario_id: solicitud.id_usuario,
        asunto: `Presupuesto insuficiente - Solicitud #${solicitud.id}`,
        mensaje: mensajeDefault,
        solicitud_id: solicitud.id,
        tipo: "presupuesto_insuficiente",
      });
      if (solicitud.jefe || solicitud.usuario_jefe) {
        await api.post("/mensajes", {
          destinatario_id: solicitud.jefe || solicitud.usuario_jefe,
          asunto: `[COPIA] Presupuesto insuficiente - Solicitud #${solicitud.id}`,
          mensaje: mensajeDefault,
          solicitud_id: solicitud.id,
          tipo: "presupuesto_insuficiente",
        });
      }
      await api.patch(`/solicitudes/${solicitud.id}`, { estado: "presupuesto_insuficiente" });
      setSuccess(true);
      setTimeout(() => { onClose(); window.location.reload(); }, 2000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || "Error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>Presupuesto Insuficiente</Typography>
        <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>Notificar al solicitante</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>Notificación enviada.</Alert>}
        {!success && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: "var(--fg-strong)" }}>Mensaje:</Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "var(--bg-soft)" }}>
                <Typography variant="body2" sx={{ color: "var(--fg-strong)" }}>{mensajeDefault}</Typography>
              </Paper>
            </Box>
            <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
              Destinatario: <strong style={{ color: "var(--fg-strong)" }}>{nombreCompleto}</strong>
            </Typography>
          </Box>
        )}
      </DialogContent>
      {!success && (
        <DialogActions>
          <Button onClick={onClose} disabled={sending} sx={{ color: "var(--fg-muted)" }}>Cancelar</Button>
          <Button variant="contained" onClick={handleEnviar} disabled={sending}>
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
