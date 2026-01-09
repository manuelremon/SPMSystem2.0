/**
 * AdminBasesDatos - Administracion de Bases de Datos
 * Permite ver estado, explorar tablas, optimizar y exportar BDs
 */

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { Modal } from "../../components/ui/Modal";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";
import {
  Database,
  RefreshCcw,
  Download,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  List,
  Search,
  Zap,
  Shield,
  HardDrive,
  Clock,
  FileText,
  ICON_COLORS,
} from "../../components/ui/Icons";

export default function AdminBasesDatos() {
  const { t } = useI18n();

  // Estado general
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Datos
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState("spm");
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableStructure, setTableStructure] = useState(null);
  const [tablePreview, setTablePreview] = useState(null);
  const [poolStats, setPoolStats] = useState(null);
  const [isProduction, setIsProduction] = useState(false);

  // Modales
  const [structureModal, setStructureModal] = useState({ open: false });
  const [previewModal, setPreviewModal] = useState({ open: false });
  const [operationLoading, setOperationLoading] = useState(false);

  // Cargar vista general
  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/database/overview");
      if (res.data.ok) {
        setDatabases(res.data.databases);
        setIsProduction(res.data.is_production);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al cargar bases de datos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar tablas de una BD
  const loadTables = useCallback(async (dbName) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/database/tables?db=${dbName}`);
      if (res.data.ok) {
        setTables(res.data.tables);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al cargar tablas");
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar estructura de tabla
  const loadTableStructure = async (tableName) => {
    try {
      const res = await api.get(`/admin/database/tables/${tableName}/structure?db=${selectedDb}`);
      if (res.data.ok) {
        setTableStructure(res.data);
        setStructureModal({ open: true });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al cargar estructura");
    }
  };

  // Cargar preview de tabla
  const loadTablePreview = async (tableName) => {
    setSelectedTable(tableName);
    try {
      const res = await api.get(`/admin/database/tables/${tableName}/preview?db=${selectedDb}&limit=50`);
      if (res.data.ok) {
        setTablePreview(res.data);
        setPreviewModal({ open: true });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al cargar datos");
    }
  };

  // Cargar estadisticas del pool
  const loadPoolStats = async () => {
    try {
      const res = await api.get("/admin/database/pool-stats");
      if (res.data.ok) {
        setPoolStats(res.data.pools);
      }
    } catch (err) {
      console.error("Error loading pool stats:", err);
    }
  };

  // Operaciones de BD
  const runOperation = async (operation, successMsg) => {
    setOperationLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/database/${operation}`, { db: selectedDb });
      if (res.data.ok) {
        setSuccess(res.data.message || successMsg);
        setTimeout(() => setSuccess(""), 5000);
        loadOverview();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || `Error en ${operation}`);
    } finally {
      setOperationLoading(false);
    }
  };

  // Verificar integridad
  const [integrityResult, setIntegrityResult] = useState(null);
  const runIntegrityCheck = async () => {
    setOperationLoading(true);
    setError("");
    try {
      const res = await api.post("/admin/database/integrity-check", { db: selectedDb });
      if (res.data.ok) {
        setIntegrityResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error en verificacion");
    } finally {
      setOperationLoading(false);
    }
  };

  // Descargar BD
  const downloadDatabase = () => {
    window.open(`/api/admin/database/export/${selectedDb}`, "_blank");
  };

  // Exportar tabla a CSV
  const exportTableCsv = (tableName) => {
    window.open(`/api/admin/database/tables/${tableName}/export-csv?db=${selectedDb}`, "_blank");
  };

  // Efectos
  useEffect(() => {
    loadOverview();
    loadPoolStats();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === "tables") {
      loadTables(selectedDb);
    }
  }, [activeTab, selectedDb, loadTables]);

  // Formatear bytes
  const formatSize = (mb) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  const tabs = [
    { id: "overview", label: t("db_overview", "Vista General"), icon: <Database className="w-4 h-4" /> },
    { id: "tables", label: t("db_tables", "Tablas"), icon: <List className="w-4 h-4" /> },
    { id: "tools", label: t("db_tools", "Herramientas"), icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_bases_datos", "Bases de Datos")}
        subtitle={isProduction ? "PostgreSQL (Produccion)" : "SQLite (Desarrollo)"}
      />

      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Vista General */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button variant="ghost" onClick={loadOverview} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {t("common_actualizar", "Actualizar")}
            </Button>
          </div>

          {loading ? (
            <TableSkeleton rows={4} columns={6} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {databases.map((db) => (
                <Card key={db.name} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className={`w-5 h-5 ${ICON_COLORS.primary}`} />
                        <CardTitle className="text-sm font-semibold uppercase">{db.name}</CardTitle>
                      </div>
                      <Badge variant={db.status === "online" ? "success" : "danger"}>
                        {db.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--fg-muted)]">Tipo</span>
                      <span className="font-mono">{db.type}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--fg-muted)]">Tamano</span>
                      <span className="font-mono">{formatSize(db.size_mb)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--fg-muted)]">Tablas</span>
                      <span className="font-mono">{db.tables}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--fg-muted)]">Registros</span>
                      <span className="font-mono">{db.records?.toLocaleString() || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--fg-muted)]">Latencia</span>
                      <span className="font-mono">{db.latency_ms} ms</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pool Stats */}
          {poolStats && Object.keys(poolStats).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className={`w-5 h-5 ${ICON_COLORS.secondary}`} />
                  {t("db_pool_stats", "Pool de Conexiones")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(poolStats).map(([name, stats]) => (
                    <div key={name} className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
                      <p className="text-sm font-medium text-[var(--fg)]">{name}</p>
                      <div className="mt-2 space-y-1 text-xs text-[var(--fg-muted)]">
                        <p>Creadas: {stats.created || 0}</p>
                        <p>Reutilizadas: {stats.reused || 0}</p>
                        <p>Expiradas: {stats.expired || 0}</p>
                        <p>Errores: {stats.errors || 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Explorador de Tablas */}
      {activeTab === "tables" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Select
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
                label={t("db_select", "Base de datos")}
              >
                {databases.map((db) => (
                  <option key={db.name} value={db.name}>{db.name}</option>
                ))}
              </Select>
            </div>
            <Button variant="ghost" onClick={() => loadTables(selectedDb)} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {loading ? (
            <TableSkeleton rows={10} columns={4} />
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-soft)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--fg-muted)] uppercase">Tabla</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[var(--fg-muted)] uppercase">Registros</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-[var(--fg-muted)] uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {tables.map((table) => (
                      <tr key={table.name} className="hover:bg-[var(--bg-soft)]/50">
                        <td className="px-4 py-3 font-mono text-[var(--primary)]">{table.name}</td>
                        <td className="px-4 py-3 text-right font-mono">{table.records.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => loadTableStructure(table.name)}>
                              <FileText className="w-4 h-4" />
                              Estructura
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => loadTablePreview(table.name)}>
                              <Search className="w-4 h-4" />
                              Ver datos
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => exportTableCsv(table.name)}>
                              <Download className="w-4 h-4" />
                              CSV
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Herramientas */}
      {activeTab === "tools" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-48">
              <Select
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
                label={t("db_select", "Base de datos")}
              >
                {databases.filter(db => db.type === "sqlite").map((db) => (
                  <option key={db.name} value={db.name}>{db.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Optimizar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${ICON_COLORS.warning}`} />
                  Optimizar
                </CardTitle>
                <CardDescription>Crear indices, analizar y compactar</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => runOperation("optimize", "BD optimizada")}
                  disabled={operationLoading || isProduction && selectedDb === "spm"}
                  className="w-full"
                >
                  {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Ejecutar Optimizacion
                </Button>
              </CardContent>
            </Card>

            {/* VACUUM */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className={`w-5 h-5 ${ICON_COLORS.info}`} />
                  VACUUM
                </CardTitle>
                <CardDescription>Compactar y liberar espacio</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={() => runOperation("vacuum", "VACUUM completado")}
                  disabled={operationLoading || isProduction && selectedDb === "spm"}
                  className="w-full"
                >
                  {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                  Ejecutar VACUUM
                </Button>
              </CardContent>
            </Card>

            {/* ANALYZE */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${ICON_COLORS.success}`} />
                  ANALYZE
                </CardTitle>
                <CardDescription>Actualizar estadisticas de tablas</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={() => runOperation("analyze", "ANALYZE completado")}
                  disabled={operationLoading}
                  className="w-full"
                >
                  {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Ejecutar ANALYZE
                </Button>
              </CardContent>
            </Card>

            {/* Crear Indices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className={`w-5 h-5 ${ICON_COLORS.primary}`} />
                  Crear Indices
                </CardTitle>
                <CardDescription>Indices recomendados para rendimiento</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={() => runOperation("create-indexes", "Indices creados")}
                  disabled={operationLoading || isProduction && selectedDb === "spm"}
                  className="w-full"
                >
                  {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                  Crear Indices
                </Button>
              </CardContent>
            </Card>

            {/* Verificar Integridad */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className={`w-5 h-5 ${ICON_COLORS.danger}`} />
                  Verificar Integridad
                </CardTitle>
                <CardDescription>Comprobar consistencia de la BD</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={runIntegrityCheck}
                  disabled={operationLoading || isProduction && selectedDb === "spm"}
                  className="w-full"
                >
                  {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Verificar
                </Button>
                {integrityResult && (
                  <div className={`p-3 rounded-lg ${integrityResult.integrity_ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"} border`}>
                    <div className="flex items-center gap-2">
                      {integrityResult.integrity_ok ? (
                        <CheckCircle className={`w-5 h-5 ${ICON_COLORS.success}`} />
                      ) : (
                        <XCircle className={`w-5 h-5 ${ICON_COLORS.danger}`} />
                      )}
                      <span className="font-medium">
                        {integrityResult.integrity_ok ? "BD Integra" : "Problemas detectados"}
                      </span>
                    </div>
                    {integrityResult.foreign_key_issues > 0 && (
                      <p className="text-sm text-amber-600 mt-1">
                        {integrityResult.foreign_key_issues} problemas de FK
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Descargar Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className={`w-5 h-5 ${ICON_COLORS.info}`} />
                  Backup
                </CardTitle>
                <CardDescription>Descargar copia de la BD</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={downloadDatabase}
                  disabled={isProduction && selectedDb === "spm"}
                  className="w-full"
                >
                  <Download className="w-4 h-4" />
                  Descargar {selectedDb}.db
                </Button>
              </CardContent>
            </Card>
          </div>

          {isProduction && (
            <Alert variant="warning">
              <AlertTriangle className="w-4 h-4" />
              Algunas operaciones no estan disponibles para PostgreSQL en produccion
            </Alert>
          )}
        </div>
      )}

      {/* Modal de Estructura */}
      <Modal
        isOpen={structureModal.open}
        onClose={() => setStructureModal({ open: false })}
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

            {tableStructure.indexes.length > 0 && (
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

      {/* Modal de Preview */}
      <Modal
        isOpen={previewModal.open}
        onClose={() => setPreviewModal({ open: false })}
        title={`Datos: ${tablePreview?.table} (${tablePreview?.total?.toLocaleString()} registros)`}
        size="xl"
      >
        {tablePreview && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-soft)]">
                <tr>
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
        )}
      </Modal>
    </div>
  );
}
