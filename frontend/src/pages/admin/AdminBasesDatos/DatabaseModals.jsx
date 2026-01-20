/**
 * DatabaseModals - Modales para administracion de BD
 * Estructura, Preview/CRUD, Stats, Audit, Connections
 */

import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Input } from "../../../components/ui/Input";
import {
  CheckCircle,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  XCircle,
  RefreshCcw,
  Shield,
  ICON_COLORS,
} from "../../../components/ui/Icons";
import { getInputType } from "./useAdminDatabase";

// Modal de Estructura de Tabla
export function StructureModal({ isOpen, onClose, tableStructure }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Estructura: ${tableStructure?.table}`}
      size="lg"
    >
      {tableStructure && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-[var(--fg-muted)] uppercase mb-2">Columnas</h4>
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-soft)]">
                <tr>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-center">PK</th>
                  <th className="px-3 py-2 text-center">Nullable</th>
                  <th className="px-3 py-2 text-left">Default</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {tableStructure.columns.map((col, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-[var(--primary)]">{col.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{col.type}</td>
                    <td className="px-3 py-2 text-center">{col.pk ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : "-"}</td>
                    <td className="px-3 py-2 text-center">{col.nullable ? "Si" : "No"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{col.default || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tableStructure.indexes?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--fg-muted)] uppercase mb-2">Indices</h4>
              <div className="space-y-2">
                {tableStructure.indexes.map((idx, i) => (
                  <div key={i} className="p-2 rounded bg-[var(--bg-soft)] border border-[var(--border)]">
                    <p className="font-mono text-sm text-[var(--primary)]">{idx.name}</p>
                    {idx.columns && <p className="text-xs text-[var(--fg-muted)]">Columnas: {idx.columns.join(", ")}</p>}
                    {idx.unique && <Badge variant="info" className="text-xs mt-1">UNIQUE</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// Modal de Preview con CRUD
export function PreviewModal({
  isOpen,
  onClose,
  tablePreview,
  isReadOnly,
  onAdd,
  onEdit,
  onDelete,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Datos: ${tablePreview?.table}`}
      size="xl"
    >
      {tablePreview && (
        <div className="space-y-4">
          {/* Boton agregar */}
          {!isReadOnly && (
            <div className="flex justify-end">
              <Button onClick={onAdd} size="sm">
                <Plus className="w-4 h-4" />
                Agregar registro
              </Button>
            </div>
          )}

          {isReadOnly && (
            <Alert variant="warning" className="py-2">
              <Shield className="w-4 h-4" />
              Esta tabla es de solo lectura
            </Alert>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-soft)]">
                <tr>
                  {!isReadOnly && (
                    <th className="px-2 py-2 text-center font-medium text-[var(--fg-muted)] w-20">
                      Acciones
                    </th>
                  )}
                  {tablePreview.columns.map((col) => (
                    <th key={col} className="px-2 py-2 text-left font-medium text-[var(--fg-muted)] whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {tablePreview.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--bg-soft)]/50">
                    {!isReadOnly && (
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEdit(row)}
                            className="p-1 hover:bg-[var(--bg-soft)] rounded"
                            title="Editar"
                          >
                            <Edit2 className={`w-3.5 h-3.5 ${ICON_COLORS.info}`} />
                          </button>
                          <button
                            onClick={() => onDelete(row)}
                            className="p-1 hover:bg-[var(--bg-soft)] rounded"
                            title="Eliminar"
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${ICON_COLORS.danger}`} />
                          </button>
                        </div>
                      </td>
                    )}
                    {tablePreview.columns.map((col) => (
                      <td key={col} className="px-2 py-1.5 font-mono whitespace-nowrap max-w-[200px] truncate">
                        {row[col] ?? <span className="text-[var(--fg-muted)]">NULL</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-[var(--fg-muted)] mt-3 text-center">
              Mostrando {tablePreview.rows.length} de {tablePreview.total.toLocaleString()} registros
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Modal de Agregar/Editar Registro
export function CrudFormModal({
  isOpen,
  onClose,
  title,
  tableColumns,
  tablePk,
  formData,
  editRow,
  loading,
  onFormChange,
  onSubmit,
  isEdit = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <div className="space-y-4">
        {/* Mostrar PK (solo lectura) para edicion */}
        {isEdit && tablePk.map((pkCol) => (
          <div key={pkCol}>
            <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
              {pkCol} (PK - Solo lectura)
            </label>
            <Input
              value={editRow?.[pkCol] || ""}
              disabled
              className="bg-[var(--bg-soft)]"
            />
          </div>
        ))}

        {tableColumns.filter(col => col.editable && !col.is_pk).map((col) => (
          <div key={col.name}>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1">
              {col.name}
              {!col.nullable && <span className="text-red-500 ml-1">*</span>}
            </label>
            {getInputType(col.type) === "checkbox" ? (
              <input
                type="checkbox"
                checked={formData[col.name] === "1" || formData[col.name] === true || formData[col.name] === "true"}
                onChange={(e) => onFormChange(col.name, e.target.checked ? "1" : "0")}
                className="h-4 w-4"
              />
            ) : (
              <Input
                type={getInputType(col.type)}
                value={formData[col.name] || ""}
                onChange={(e) => onFormChange(col.name, e.target.value)}
                placeholder={col.type}
              />
            )}
            {!isEdit && (
              <p className="text-xs text-[var(--fg-muted)] mt-1">
                Tipo: {col.type} {col.default && `| Default: ${col.default}`}
              </p>
            )}
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : isEdit ? (
              <Edit2 className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {isEdit ? "Guardar cambios" : "Crear registro"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Modal de Eliminar Registro
export function DeleteModal({
  isOpen,
  onClose,
  row,
  loading,
  onDelete,
  onSoftDelete,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar eliminacion"
      size="md"
    >
      <div className="space-y-4">
        <Alert variant="danger">
          <AlertTriangle className="w-4 h-4" />
          Esta accion no se puede deshacer. El registro sera eliminado permanentemente.
        </Alert>

        <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
          <p className="text-sm font-medium mb-2">Datos del registro:</p>
          <div className="space-y-1 text-xs font-mono">
            {row && Object.entries(row).slice(0, 8).map(([key, val]) => (
              <div key={key} className="flex">
                <span className="text-[var(--fg-muted)] w-24">{key}:</span>
                <span className="truncate max-w-[200px]">{val ?? "NULL"}</span>
              </div>
            ))}
            {row && Object.keys(row).length > 8 && (
              <p className="text-[var(--fg-muted)]">... y {Object.keys(row).length - 8} campos mas</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={onSoftDelete} disabled={loading}>
            {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Soft Delete
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={loading}>
            {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Modal de Estadisticas de Tabla
export function StatsModal({ isOpen, onClose, tableName, tableStats }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Estadisticas: ${tableName}`}
      size="md"
    >
      {tableStats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
              <p className="text-sm text-[var(--fg-muted)]">Filas</p>
              <p className="text-2xl font-bold">{tableStats.stats.actual_rows?.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
              <p className="text-sm text-[var(--fg-muted)]">Tamaño</p>
              <p className="text-2xl font-bold">{tableStats.stats.total_size_mb} MB</p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
              <p className="text-sm text-[var(--fg-muted)]">Indices</p>
              <p className="text-2xl font-bold">{tableStats.stats.index_count}</p>
            </div>
            {tableStats.type === "postgresql" && (
              <div className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
                <p className="text-sm text-[var(--fg-muted)]">Fragmentacion</p>
                <p className={`text-2xl font-bold ${tableStats.stats.fragmentation_pct > 20 ? "text-amber-500" : "text-emerald-500"}`}>
                  {tableStats.stats.fragmentation_pct}%
                </p>
              </div>
            )}
          </div>

          {tableStats.type === "postgresql" && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[var(--fg-muted)]">Ultimo Mantenimiento</h4>
              <div className="text-sm space-y-1">
                <p><span className="text-[var(--fg-muted)]">VACUUM:</span> {tableStats.stats.last_vacuum || tableStats.stats.last_autovacuum || "Nunca"}</p>
                <p><span className="text-[var(--fg-muted)]">ANALYZE:</span> {tableStats.stats.last_analyze || tableStats.stats.last_autoanalyze || "Nunca"}</p>
              </div>
              <div className="text-sm mt-2">
                <p><span className="text-[var(--fg-muted)]">Live tuples:</span> {tableStats.stats.live_tuples?.toLocaleString()}</p>
                <p><span className="text-[var(--fg-muted)]">Dead tuples:</span> {tableStats.stats.dead_tuples?.toLocaleString()}</p>
              </div>
            </div>
          )}

          {tableStats.type === "sqlite" && (
            <div className="text-sm space-y-1">
              <p><span className="text-[var(--fg-muted)]">Paginas:</span> {tableStats.stats.page_count?.toLocaleString()}</p>
              <p><span className="text-[var(--fg-muted)]">Tamaño pagina:</span> {tableStats.stats.page_size} bytes</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// Modal de Audit Logs
export function AuditModal({ isOpen, onClose, auditLogs }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Log - Ultimos 7 dias"
      size="xl"
    >
      <div className="max-h-[60vh] overflow-auto">
        {auditLogs.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-center py-8">No hay registros de auditoria</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-soft)] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Accion</th>
                <th className="px-3 py-2 text-left">Entidad</th>
                <th className="px-3 py-2 text-left">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--bg-soft)]">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={
                      log.action.includes("DELETE") ? "danger" :
                      log.action.includes("CREATE") ? "success" :
                      log.action.includes("UPDATE") ? "warning" : "default"
                    }>
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{log.entity_type}</td>
                  <td className="px-3 py-2 text-xs">{log.user_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

// Modal de Conexiones Activas
export function ConnectionsModal({ isOpen, onClose, connections }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conexiones Activas - PostgreSQL"
      size="xl"
    >
      <div className="max-h-[60vh] overflow-auto">
        {connections.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-center py-8">No hay conexiones activas</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-soft)] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">PID</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">App</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Duracion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {connections.map((conn) => (
                <tr key={conn.pid} className="hover:bg-[var(--bg-soft)]">
                  <td className="px-3 py-2 font-mono">{conn.pid}</td>
                  <td className="px-3 py-2">{conn.user}</td>
                  <td className="px-3 py-2 text-xs">{conn.application || "-"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={
                      conn.state === "active" ? "success" :
                      conn.state === "idle" ? "default" : "warning"
                    }>
                      {conn.state}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {conn.query_duration_sec ? `${conn.query_duration_sec}s` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}
