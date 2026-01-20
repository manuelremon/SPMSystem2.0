/**
 * useAdminDatabase - Hook para operaciones de administracion de BD
 * Centraliza toda la logica de datos del componente AdminBasesDatos
 */

import { useState, useEffect, useCallback } from "react";
import api from "../../../services/api";

export function useAdminDatabase() {
  // Estado general
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Datos principales
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState("spm");
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableStructure, setTableStructure] = useState(null);
  const [tablePreview, setTablePreview] = useState(null);
  const [poolStats, setPoolStats] = useState(null);
  const [isProduction, setIsProduction] = useState(false);

  // Operaciones
  const [operationLoading, setOperationLoading] = useState(false);
  const [integrityResult, setIntegrityResult] = useState(null);

  // CRUD
  const [tableColumns, setTableColumns] = useState([]);
  const [tablePk, setTablePk] = useState([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [crudLoading, setCrudLoading] = useState(false);

  // Herramientas avanzadas
  const [tableStats, setTableStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [connections, setConnections] = useState([]);

  // Helpers
  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

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
  const loadTableStructure = useCallback(async (tableName) => {
    try {
      const res = await api.get(`/admin/database/tables/${tableName}/structure?db=${selectedDb}`);
      if (res.data.ok) {
        setTableStructure(res.data);
        return res.data;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al cargar estructura");
    }
    return null;
  }, [selectedDb]);

  // Cargar columnas para CRUD (filtra protegidas)
  const loadTableColumnsForCrud = useCallback(async (tableName) => {
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
  }, [selectedDb]);

  // Cargar preview de tabla
  const loadTablePreview = useCallback(async (tableName) => {
    setSelectedTable(tableName);
    try {
      const [previewRes] = await Promise.all([
        api.get(`/admin/database/tables/${tableName}/preview?db=${selectedDb}&limit=50`),
        loadTableColumnsForCrud(tableName),
      ]);
      if (previewRes.data.ok) {
        setTablePreview(previewRes.data);
        return previewRes.data;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al cargar datos");
    }
    return null;
  }, [selectedDb, loadTableColumnsForCrud]);

  // Cargar estadisticas del pool
  const loadPoolStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/database/pool-stats");
      if (res.data.ok) {
        setPoolStats(res.data.pools);
      }
    } catch (err) {
      console.error("Error loading pool stats:", err);
    }
  }, []);

  // Operaciones de BD
  const runOperation = useCallback(async (operation, successMsg) => {
    setOperationLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/database/${operation}`, { db: selectedDb });
      if (res.data.ok) {
        showSuccess(res.data.message || successMsg);
        loadOverview();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || `Error en ${operation}`);
    } finally {
      setOperationLoading(false);
    }
  }, [selectedDb, loadOverview, showSuccess]);

  // Verificar integridad
  const runIntegrityCheck = useCallback(async () => {
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
  }, [selectedDb]);

  // Descargar BD
  const downloadDatabase = useCallback(() => {
    window.open(`/api/admin/database/export/${selectedDb}`, "_blank");
  }, [selectedDb]);

  // Exportar tabla a CSV
  const exportTableCsv = useCallback((tableName) => {
    window.open(`/api/admin/database/tables/${tableName}/export-csv?db=${selectedDb}`, "_blank");
  }, [selectedDb]);

  // Ver estadisticas de tabla
  const loadTableStats = useCallback(async (tableName) => {
    setOperationLoading(true);
    setError("");
    try {
      const res = await api.get(`/admin/database/tables/${tableName}/stats?db=${selectedDb}`);
      if (res.data.ok) {
        setTableStats(res.data);
        return res.data;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error cargando estadisticas");
    } finally {
      setOperationLoading(false);
    }
    return null;
  }, [selectedDb]);

  // Ver audit logs
  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/database/audit-logs?days=7&limit=100");
      if (res.data.ok) {
        setAuditLogs(res.data.logs || []);
        return res.data.logs || [];
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error cargando audit logs");
    } finally {
      setAuditLoading(false);
    }
    return [];
  }, []);

  // Ver conexiones activas (PostgreSQL)
  const loadConnections = useCallback(async () => {
    setOperationLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/database/connections");
      if (res.data.ok) {
        setConnections(res.data.connections || []);
        return res.data.connections || [];
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
    return [];
  }, []);

  // CRUD Operations
  const createRecord = useCallback(async (tableName, formData) => {
    setCrudLoading(true);
    setError("");
    try {
      const res = await api.post(`/admin/database/tables/${tableName}/rows`, {
        db: selectedDb,
        data: formData,
      });
      if (res.data.ok) {
        showSuccess(res.data.message || "Registro creado");
        return true;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al crear registro");
    } finally {
      setCrudLoading(false);
    }
    return false;
  }, [selectedDb, showSuccess]);

  const updateRecord = useCallback(async (tableName, pkData, formData) => {
    setCrudLoading(true);
    setError("");
    try {
      const res = await api.put(`/admin/database/tables/${tableName}/rows`, {
        db: selectedDb,
        pk: pkData,
        data: formData,
      });
      if (res.data.ok) {
        showSuccess(res.data.message || "Registro actualizado");
        return true;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al actualizar registro");
    } finally {
      setCrudLoading(false);
    }
    return false;
  }, [selectedDb, showSuccess]);

  const deleteRecord = useCallback(async (tableName, pkData, softDelete = false) => {
    setCrudLoading(true);
    setError("");
    try {
      const res = await api.delete(`/admin/database/tables/${tableName}/rows`, {
        data: {
          db: selectedDb,
          pk: pkData,
          soft_delete: softDelete,
        },
      });
      if (res.data.ok) {
        showSuccess(res.data.message || "Registro eliminado");
        return true;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al eliminar registro");
    } finally {
      setCrudLoading(false);
    }
    return false;
  }, [selectedDb, showSuccess]);

  // Helper para determinar el tipo de BD seleccionada
  const selectedDbInfo = databases.find(db => db.name === selectedDb);
  const isPostgres = selectedDbInfo?.type === "postgresql";
  const isSqlite = selectedDbInfo?.type === "sqlite";

  // Effects
  useEffect(() => {
    loadOverview();
    loadPoolStats();
  }, [loadOverview, loadPoolStats]);

  return {
    // Estado
    loading,
    error,
    success,
    setError,
    clearMessages,

    // Datos
    databases,
    selectedDb,
    setSelectedDb,
    tables,
    selectedTable,
    setSelectedTable,
    tableStructure,
    tablePreview,
    poolStats,
    isProduction,
    isPostgres,
    isSqlite,

    // CRUD
    tableColumns,
    tablePk,
    isReadOnly,
    crudLoading,

    // Operaciones
    operationLoading,
    integrityResult,
    tableStats,
    auditLogs,
    auditLoading,
    connections,

    // Acciones
    loadOverview,
    loadTables,
    loadTableStructure,
    loadTablePreview,
    loadPoolStats,
    runOperation,
    runIntegrityCheck,
    downloadDatabase,
    exportTableCsv,
    loadTableStats,
    loadAuditLogs,
    loadConnections,
    createRecord,
    updateRecord,
    deleteRecord,
    loadTableColumnsForCrud,
  };
}

// Helper para formatear bytes
export function formatSize(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(2)} MB`;
}

// Helper para obtener tipo de input segun tipo de columna
export function getInputType(colType) {
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
}
