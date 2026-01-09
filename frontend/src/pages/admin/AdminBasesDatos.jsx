/**
 * AdminBasesDatos - Administracion de Bases de Datos
 * Permite ver estado, explorar tablas, optimizar, exportar y CRUD de registros
 */

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
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
  Plus,
  Edit2,
  Trash2,
  BarChart2,
  Activity,
  History,
  Users,
  Upload,
  ICON_COLORS,
} from "../../components/ui/Icons";
import { ImportExcelModal } from "../../components/admin/ImportExcelModal";
import { TempDataBanner } from "../../components/ui/TempDataBanner";

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

  // Modales existentes
  const [structureModal, setStructureModal] = useState({ open: false });
  const [previewModal, setPreviewModal] = useState({ open: false });
  const [operationLoading, setOperationLoading] = useState(false);

  // CRUD - Nuevos estados
  const [tableColumns, setTableColumns] = useState([]);
  const [tablePk, setTablePk] = useState([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [addModal, setAddModal] = useState({ open: false });
  const [editModal, setEditModal] = useState({ open: false, row: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, row: null });
  const [formData, setFormData] = useState({});
  const [crudLoading, setCrudLoading] = useState(false);

  // Herramientas avanzadas
  const [tableStats, setTableStats] = useState(null);
  const [statsModal, setStatsModal] = useState({ open: false, table: null });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditModal, setAuditModal] = useState({ open: false });
  const [auditLoading, setAuditLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [connectionsModal, setConnectionsModal] = useState({ open: false });

  // Estado para importación de datos temporales
  const [importExcelModal, setImportExcelModal] = useState(false);
  const [tempModeActive, setTempModeActive] = useState(false);

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

  // Cargar columnas para CRUD (filtra protegidas)
  const loadTableColumnsForCrud = async (tableName) => {
    try {
      const res = await api.get(`/admin/database/tables/${tableName}/columns?db=${selectedDb}`);
      if (res.data.ok) {
        setTableColumns(res.data.columns);
        setTablePk(res.data.primary_key || []);
        setIsReadOnly(res.data.read_only || false);
      }
    } catch (err) {
      console.error("Error loading columns for CRUD:", err);
    }
  };

  // Cargar preview de tabla
  const loadTablePreview = async (tableName) => {
    setSelectedTable(tableName);
    try {
      const [previewRes] = await Promise.all([
        api.get(`/admin/database/tables/${tableName}/preview?db=${selectedDb}&limit=50`),
        loadTableColumnsForCrud(tableName),
      ]);
      if (previewRes.data.ok) {
        setTablePreview(previewRes.data);
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

  // Ver estadisticas de tabla
  const loadTableStats = async (tableName) => {
    setOperationLoading(true);
    setError("");
    try {
      const res = await api.get(`/admin/database/tables/${tableName}/stats?db=${selectedDb}`);
      if (res.data.ok) {
        setTableStats(res.data);
        setStatsModal({ open: true, table: tableName });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error cargando estadisticas");
    } finally {
      setOperationLoading(false);
    }
  };

  // Ver audit logs
  const loadAuditLogs = async () => {
    setAuditLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/database/audit-logs?days=7&limit=100");
      if (res.data.ok) {
        setAuditLogs(res.data.logs || []);
        setAuditModal({ open: true });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error cargando audit logs");
    } finally {
      setAuditLoading(false);
    }
  };

  // Ver conexiones activas (PostgreSQL)
  const loadConnections = async () => {
    setOperationLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/database/connections");
      if (res.data.ok) {
        setConnections(res.data.connections || []);
        setConnectionsModal({ open: true });
      }
    } catch (err) {
      if (err.response?.status === 400) {
        setError("Solo disponible para PostgreSQL");
      } else {
        setError(err.response?.data?.error?.message || "Error cargando conexiones");
      }
    } finally {
      setOperationLoading(false);
    }
  };

  // Helper para determinar el tipo de BD seleccionada
  const selectedDbInfo = databases.find(db => db.name === selectedDb);
  const isPostgres = selectedDbInfo?.type === "postgresql";
  const isSqlite = selectedDbInfo?.type === "sqlite";

  // ==================== CRUD OPERATIONS ====================

  // Abrir modal de agregar
  const openAddModal = () => {
    if (isReadOnly) {
      setError("Esta tabla es de solo lectura");
      return;
    }
    // Inicializar formData con valores por defecto
    const initialData = {};
    tableColumns.forEach(col => {
      if (!col.is_pk && !col.is_auto && col.editable) {
        initialData[col.name] = col.default || "";
      }
    });
    setFormData(initialData);
    setAddModal({ open: true });
  };

  // Abrir modal de editar
  const openEditModal = (row) => {
    if (isReadOnly) {
      setError("Esta tabla es de solo lectura");
      return;
    }
    // Cargar datos actuales en el form
    const editData = {};
    tableColumns.forEach(col => {
      if (col.editable) {
        editData[col.name] = row[col.name] ?? "";
      }
    });
    setFormData(editData);
    setEditModal({ open: true, row });
  };

  // Abrir modal de eliminar
  const openDeleteModal = (row) => {
    if (isReadOnly) {
      setError("Esta tabla es de solo lectura");
      return;
    }
    setDeleteModal({ open: true, row });
  };

  // Crear registro
  const handleCreate = async () => {
    setCrudLoading(true);
    setError("");
    try {
      const res = await api.post(`/admin/database/tables/${selectedTable}/rows`, {
        db: selectedDb,
        data: formData,
      });
      if (res.data.ok) {
        setSuccess(res.data.message || "Registro creado");
        setAddModal({ open: false });
        // Recargar preview
        loadTablePreview(selectedTable);
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al crear registro");
    } finally {
      setCrudLoading(false);
    }
  };

  // Actualizar registro
  const handleUpdate = async () => {
    setCrudLoading(true);
    setError("");
    try {
      // Construir PK object
      const pkData = {};
      tablePk.forEach(pkCol => {
        pkData[pkCol] = editModal.row[pkCol];
      });

      const res = await api.put(`/admin/database/tables/${selectedTable}/rows`, {
        db: selectedDb,
        pk: pkData,
        data: formData,
      });
      if (res.data.ok) {
        setSuccess(res.data.message || "Registro actualizado");
        setEditModal({ open: false, row: null });
        // Recargar preview
        loadTablePreview(selectedTable);
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al actualizar registro");
    } finally {
      setCrudLoading(false);
    }
  };

  // Eliminar registro
  const handleDelete = async (softDelete = false) => {
    setCrudLoading(true);
    setError("");
    try {
      // Construir PK object
      const pkData = {};
      tablePk.forEach(pkCol => {
        pkData[pkCol] = deleteModal.row[pkCol];
      });

      const res = await api.delete(`/admin/database/tables/${selectedTable}/rows`, {
        data: {
          db: selectedDb,
          pk: pkData,
          soft_delete: softDelete,
        },
      });
      if (res.data.ok) {
        setSuccess(res.data.message || "Registro eliminado");
        setDeleteModal({ open: false, row: null });
        // Recargar preview
        loadTablePreview(selectedTable);
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al eliminar registro");
    } finally {
      setCrudLoading(false);
    }
  };

  // Manejar cambio en form
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Obtener tipo de input segun tipo de columna
  const getInputType = (colType) => {
    const type = (colType || "").toLowerCase();
    if (type.includes("int") || type.includes("real") || type.includes("numeric") || type.includes("decimal")) {
      return "number";
    }
    if (type.includes("date")) {
      return "date";
    }
    if (type.includes("time")) {
      return "datetime-local";
    }
    if (type.includes("bool")) {
      return "checkbox";
    }
    return "text";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_bases_datos", "Bases de Datos")}
        subtitle={isProduction ? "PostgreSQL (Produccion)" : "SQLite (Desarrollo)"}
      />

      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>}

      {/* Banner de Modo Temporal */}
      <TempDataBanner
        onStatusChange={setTempModeActive}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Database className="w-4 h-4" />
            {t("db_overview", "Vista General")}
          </TabsTrigger>
          <TabsTrigger value="tables">
            <List className="w-4 h-4" />
            {t("db_tables", "Tablas")}
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Settings className="w-4 h-4" />
            {t("db_tools", "Herramientas")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
                {databases.map((db) => (
                  <option key={db.name} value={db.name}>
                    {db.name} ({db.type === "postgresql" ? "PostgreSQL" : "SQLite"})
                  </option>
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
                  <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
                </CardTitle>
                <CardDescription>
                  {isPostgres ? "VACUUM ANALYZE" : "Indices + ANALYZE + VACUUM"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => runOperation("optimize", "BD optimizada")}
                  disabled={operationLoading}
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
                  <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
                </CardTitle>
                <CardDescription>Compactar y liberar espacio</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={() => runOperation("vacuum", "VACUUM completado")}
                  disabled={operationLoading}
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
                  <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
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
            <Card className={isPostgres ? "opacity-60" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className={`w-5 h-5 ${ICON_COLORS.primary}`} />
                  Crear Indices
                  <Badge variant="warning" className="ml-auto text-xs">SQLite</Badge>
                </CardTitle>
                <CardDescription>Indices recomendados para rendimiento</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={() => runOperation("create-indexes", "Indices creados")}
                  disabled={operationLoading || isPostgres}
                  className="w-full"
                >
                  {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                  Crear Indices
                </Button>
                {isPostgres && <p className="text-xs text-amber-600 mt-2">No disponible para PostgreSQL</p>}
              </CardContent>
            </Card>

            {/* Verificar Integridad */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className={`w-5 h-5 ${ICON_COLORS.danger}`} />
                  Verificar Integridad
                  <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
                </CardTitle>
                <CardDescription>
                  {isPostgres ? "Indices invalidos y fragmentacion" : "PRAGMA integrity_check"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={runIntegrityCheck}
                  disabled={operationLoading}
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
                    {integrityResult.bloated_tables?.length > 0 && (
                      <p className="text-sm text-amber-600 mt-1">
                        {integrityResult.bloated_tables.length} tablas con fragmentacion
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Descargar Backup */}
            <Card className={isPostgres ? "opacity-60" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className={`w-5 h-5 ${ICON_COLORS.info}`} />
                  Backup
                  <Badge variant="warning" className="ml-auto text-xs">SQLite</Badge>
                </CardTitle>
                <CardDescription>Descargar copia de la BD</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={downloadDatabase}
                  disabled={isPostgres}
                  className="w-full"
                >
                  <Download className="w-4 h-4" />
                  Descargar {selectedDb}.db
                </Button>
                {isPostgres && <p className="text-xs text-amber-600 mt-2">Use pg_dump para PostgreSQL</p>}
              </CardContent>
            </Card>

            {/* Estadisticas de Tabla */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className={`w-5 h-5 ${ICON_COLORS.primary}`} />
                  Estadisticas
                  <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
                </CardTitle>
                <CardDescription>Ver tamaño, filas e indices de una tabla</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Select
                    value={selectedTable || ""}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="flex-1"
                  >
                    <option value="">Seleccionar tabla...</option>
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={() => selectedTable && loadTableStats(selectedTable)}
                    disabled={operationLoading || !selectedTable}
                  >
                    <BarChart2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className={`w-5 h-5 ${ICON_COLORS.warning}`} />
                  Audit Log
                  <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
                </CardTitle>
                <CardDescription>Ver historial de operaciones CRUD</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={loadAuditLogs}
                  disabled={auditLoading}
                  className="w-full"
                >
                  {auditLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
                  Ver Ultimos 7 dias
                </Button>
              </CardContent>
            </Card>

            {/* Conexiones Activas */}
            <Card className={!isPostgres ? "opacity-60" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className={`w-5 h-5 ${ICON_COLORS.info}`} />
                  Conexiones
                  <Badge variant="info" className="ml-auto text-xs">PostgreSQL</Badge>
                </CardTitle>
                <CardDescription>Ver conexiones activas</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  onClick={loadConnections}
                  disabled={operationLoading || !isPostgres}
                  className="w-full"
                >
                  {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Ver Conexiones
                </Button>
                {!isPostgres && <p className="text-xs text-amber-600 mt-2">Solo disponible para PostgreSQL</p>}
              </CardContent>
            </Card>

            {/* Pool Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className={`w-5 h-5 ${ICON_COLORS.success}`} />
                  Pool Stats
                  <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
                </CardTitle>
                <CardDescription>Estadisticas del pool de conexiones</CardDescription>
              </CardHeader>
              <CardContent>
                {poolStats ? (
                  <div className="space-y-2 text-sm">
                    {Object.entries(poolStats).map(([pool, stats]) => (
                      <div key={pool} className="p-2 bg-[var(--bg-soft)] rounded">
                        <p className="font-medium">{pool}</p>
                        <p className="text-xs text-[var(--fg-muted)]">
                          Activas: {stats.active || 0} | Idle: {stats.idle || 0}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">Cargando...</p>
                )}
              </CardContent>
            </Card>

            {/* Importar Datos Temporales */}
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  Datos Temporales
                  <Badge variant="warning" className="ml-auto text-xs">MRP/Forecast</Badge>
                </CardTitle>
                <CardDescription>
                  Importar Excel para operar MRP y Forecast con datos temporales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-[var(--fg-muted)]">
                  Permite trabajar con datos importados desde Excel sin afectar las bases de datos del sistema.
                  Ideal para pruebas y analisis.
                </p>
                <Button
                  onClick={() => setImportExcelModal(true)}
                  className="w-full bg-amber-500 hover:bg-amber-600"
                  disabled={tempModeActive}
                >
                  <Upload className="w-4 h-4" />
                  {tempModeActive ? "Modo Temporal Activo" : "Importar Excel"}
                </Button>
                {tempModeActive && (
                  <p className="text-xs text-amber-600 text-center">
                    Desactive el modo temporal desde el banner superior para importar nuevos datos
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {isProduction && (
            <Alert variant="info" className="mt-4">
              <AlertTriangle className="w-4 h-4" />
              PostgreSQL en produccion: Algunas operaciones (VACUUM, Optimize) funcionan pero requieren permisos adecuados.
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

      {/* Modal de Preview con CRUD */}
      <Modal
        isOpen={previewModal.open}
        onClose={() => setPreviewModal({ open: false })}
        title={`Datos: ${tablePreview?.table} (${tablePreview?.total?.toLocaleString()} registros)`}
        size="xl"
      >
        {tablePreview && (
          <div className="space-y-4">
            {/* Boton agregar */}
            {!isReadOnly && (
              <div className="flex justify-end">
                <Button onClick={openAddModal} size="sm">
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
                              onClick={() => openEditModal(row)}
                              className="p-1 hover:bg-[var(--bg-soft)] rounded"
                              title="Editar"
                            >
                              <Edit2 className={`w-3.5 h-3.5 ${ICON_COLORS.info}`} />
                            </button>
                            <button
                              onClick={() => openDeleteModal(row)}
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

      {/* Modal de Agregar Registro */}
      <Modal
        isOpen={addModal.open}
        onClose={() => setAddModal({ open: false })}
        title={`Agregar registro a ${selectedTable}`}
        size="md"
      >
        <div className="space-y-4">
          {tableColumns.filter(col => col.editable && !col.is_pk).map((col) => (
            <div key={col.name}>
              <label className="block text-sm font-medium text-[var(--fg)] mb-1">
                {col.name}
                {!col.nullable && <span className="text-red-500 ml-1">*</span>}
              </label>
              {getInputType(col.type) === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={formData[col.name] === "1" || formData[col.name] === true}
                  onChange={(e) => handleFormChange(col.name, e.target.checked ? "1" : "0")}
                  className="h-4 w-4"
                />
              ) : (
                <Input
                  type={getInputType(col.type)}
                  value={formData[col.name] || ""}
                  onChange={(e) => handleFormChange(col.name, e.target.value)}
                  placeholder={col.type}
                />
              )}
              <p className="text-xs text-[var(--fg-muted)] mt-1">
                Tipo: {col.type} {col.default && `| Default: ${col.default}`}
              </p>
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setAddModal({ open: false })} disabled={crudLoading}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={crudLoading}>
              {crudLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear registro
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Editar Registro */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, row: null })}
        title={`Editar registro de ${selectedTable}`}
        size="md"
      >
        <div className="space-y-4">
          {/* Mostrar PK (solo lectura) */}
          {tablePk.map((pkCol) => (
            <div key={pkCol}>
              <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                {pkCol} (PK - Solo lectura)
              </label>
              <Input
                value={editModal.row?.[pkCol] || ""}
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
                  onChange={(e) => handleFormChange(col.name, e.target.checked ? "1" : "0")}
                  className="h-4 w-4"
                />
              ) : (
                <Input
                  type={getInputType(col.type)}
                  value={formData[col.name] || ""}
                  onChange={(e) => handleFormChange(col.name, e.target.value)}
                  placeholder={col.type}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setEditModal({ open: false, row: null })} disabled={crudLoading}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={crudLoading}>
              {crudLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Eliminar Registro */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, row: null })}
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
              {deleteModal.row && Object.entries(deleteModal.row).slice(0, 8).map(([key, val]) => (
                <div key={key} className="flex">
                  <span className="text-[var(--fg-muted)] w-24">{key}:</span>
                  <span className="truncate max-w-[200px]">{val ?? "NULL"}</span>
                </div>
              ))}
              {deleteModal.row && Object.keys(deleteModal.row).length > 8 && (
                <p className="text-[var(--fg-muted)]">... y {Object.keys(deleteModal.row).length - 8} campos mas</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setDeleteModal({ open: false, row: null })} disabled={crudLoading}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => handleDelete(true)} disabled={crudLoading}>
              {crudLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Soft Delete
            </Button>
            <Button variant="danger" onClick={() => handleDelete(false)} disabled={crudLoading}>
              {crudLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Estadisticas de Tabla */}
      <Modal
        isOpen={statsModal.open}
        onClose={() => setStatsModal({ open: false, table: null })}
        title={`Estadisticas: ${statsModal.table}`}
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

      {/* Modal de Audit Logs */}
      <Modal
        isOpen={auditModal.open}
        onClose={() => setAuditModal({ open: false })}
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

      {/* Modal de Conexiones Activas */}
      <Modal
        isOpen={connectionsModal.open}
        onClose={() => setConnectionsModal({ open: false })}
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

      {/* Modal de Importar Excel Temporal */}
      <ImportExcelModal
        isOpen={importExcelModal}
        onClose={() => setImportExcelModal(false)}
        onSuccess={() => {
          setTempModeActive(true);
          setSuccess("Modo temporal activado exitosamente");
          setTimeout(() => setSuccess(""), 5000);
        }}
      />
    </div>
  );
}
