/**
 * AdminBasesDatos - Administracion de Bases de Datos
 * Permite ver estado, explorar tablas, optimizar, exportar y CRUD de registros
 *
 * Modularizado en componentes separados (Sprint 23):
 * - useAdminDatabase.js: Hook con toda la logica de datos
 * - OverviewTab.jsx: Vista general de BDs
 * - TablesTab.jsx: Explorador de tablas
 * - ToolsTab.jsx: Herramientas de administracion
 * - DatabaseModals.jsx: Todos los modales
 */

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Alert } from "../../../components/ui/Alert";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/Tabs";
import { useI18n } from "../../../context/i18n";
import { Database, List, Settings } from "../../../components/ui/Icons";
import { ImportExcelModal } from "../../../components/admin/ImportExcelModal";
import { TempDataBanner } from "../../../components/ui/TempDataBanner";

// Componentes modulares
import { useAdminDatabase } from "./useAdminDatabase";
import { OverviewTab } from "./OverviewTab";
import { TablesTab } from "./TablesTab";
import { ToolsTab } from "./ToolsTab";
import {
  StructureModal,
  PreviewModal,
  CrudFormModal,
  DeleteModal,
  StatsModal,
  AuditModal,
  ConnectionsModal,
} from "./DatabaseModals";

export default function AdminBasesDatos() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");

  // Hook centralizado con toda la logica
  const db = useAdminDatabase();

  // Estados de modales
  const [structureModal, setStructureModal] = useState({ open: false });
  const [previewModal, setPreviewModal] = useState({ open: false });
  const [addModal, setAddModal] = useState({ open: false });
  const [editModal, setEditModal] = useState({ open: false, row: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, row: null });
  const [statsModal, setStatsModal] = useState({ open: false, table: null });
  const [auditModal, setAuditModal] = useState({ open: false });
  const [connectionsModal, setConnectionsModal] = useState({ open: false });
  const [importExcelModal, setImportExcelModal] = useState(false);
  const [tempModeActive, setTempModeActive] = useState(false);

  // Estado del formulario CRUD
  const [formData, setFormData] = useState({});

  // Cargar tablas cuando cambia el tab o la BD
  useEffect(() => {
    if (activeTab === "tables") {
      db.loadTables(db.selectedDb);
    }
  }, [activeTab, db.selectedDb]);

  // Handlers para modales
  const handleViewStructure = async (tableName) => {
    const data = await db.loadTableStructure(tableName);
    if (data) setStructureModal({ open: true });
  };

  const handleViewData = async (tableName) => {
    const data = await db.loadTablePreview(tableName);
    if (data) setPreviewModal({ open: true });
  };

  const handleOpenAdd = () => {
    if (db.isReadOnly) {
      db.setError("Esta tabla es de solo lectura");
      return;
    }
    const initialData = {};
    db.tableColumns.forEach(col => {
      if (!col.is_pk && !col.is_auto && col.editable) {
        initialData[col.name] = col.default || "";
      }
    });
    setFormData(initialData);
    setAddModal({ open: true });
  };

  const handleOpenEdit = (row) => {
    if (db.isReadOnly) {
      db.setError("Esta tabla es de solo lectura");
      return;
    }
    const editData = {};
    db.tableColumns.forEach(col => {
      if (col.editable) {
        editData[col.name] = row[col.name] ?? "";
      }
    });
    setFormData(editData);
    setEditModal({ open: true, row });
  };

  const handleOpenDelete = (row) => {
    if (db.isReadOnly) {
      db.setError("Esta tabla es de solo lectura");
      return;
    }
    setDeleteModal({ open: true, row });
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    const success = await db.createRecord(db.selectedTable, formData);
    if (success) {
      setAddModal({ open: false });
      db.loadTablePreview(db.selectedTable);
    }
  };

  const handleUpdate = async () => {
    const pkData = {};
    db.tablePk.forEach(pkCol => {
      pkData[pkCol] = editModal.row[pkCol];
    });
    const success = await db.updateRecord(db.selectedTable, pkData, formData);
    if (success) {
      setEditModal({ open: false, row: null });
      db.loadTablePreview(db.selectedTable);
    }
  };

  const handleDelete = async (softDelete = false) => {
    const pkData = {};
    db.tablePk.forEach(pkCol => {
      pkData[pkCol] = deleteModal.row[pkCol];
    });
    const success = await db.deleteRecord(db.selectedTable, pkData, softDelete);
    if (success) {
      setDeleteModal({ open: false, row: null });
      db.loadTablePreview(db.selectedTable);
    }
  };

  const handleLoadTableStats = async (tableName) => {
    const data = await db.loadTableStats(tableName);
    if (data) setStatsModal({ open: true, table: tableName });
  };

  const handleLoadAuditLogs = async () => {
    const data = await db.loadAuditLogs();
    if (data) setAuditModal({ open: true });
  };

  const handleLoadConnections = async () => {
    const data = await db.loadConnections();
    if (data) setConnectionsModal({ open: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_bases_datos", "Bases de Datos")}
        subtitle={db.isProduction ? "PostgreSQL (Produccion)" : "SQLite (Desarrollo)"}
      />

      {db.error && <Alert variant="danger" onDismiss={() => db.setError("")}>{db.error}</Alert>}
      {db.success && <Alert variant="success" onDismiss={db.clearMessages}>{db.success}</Alert>}

      {/* Banner de Modo Temporal */}
      <TempDataBanner onStatusChange={setTempModeActive} />

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

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          loading={db.loading}
          databases={db.databases}
          poolStats={db.poolStats}
          onRefresh={db.loadOverview}
        />
      )}

      {activeTab === "tables" && (
        <TablesTab
          loading={db.loading}
          databases={db.databases}
          selectedDb={db.selectedDb}
          onDbChange={db.setSelectedDb}
          tables={db.tables}
          onRefresh={() => db.loadTables(db.selectedDb)}
          onViewStructure={handleViewStructure}
          onViewData={handleViewData}
          onExportCsv={db.exportTableCsv}
        />
      )}

      {activeTab === "tools" && (
        <ToolsTab
          databases={db.databases}
          selectedDb={db.selectedDb}
          onDbChange={db.setSelectedDb}
          tables={db.tables}
          selectedTable={db.selectedTable}
          onTableChange={db.setSelectedTable}
          isPostgres={db.isPostgres}
          isProduction={db.isProduction}
          operationLoading={db.operationLoading}
          integrityResult={db.integrityResult}
          poolStats={db.poolStats}
          tempModeActive={tempModeActive}
          onRunOperation={db.runOperation}
          onIntegrityCheck={db.runIntegrityCheck}
          onDownloadDatabase={db.downloadDatabase}
          onLoadTableStats={handleLoadTableStats}
          onLoadAuditLogs={handleLoadAuditLogs}
          onLoadConnections={handleLoadConnections}
          onOpenImportModal={() => setImportExcelModal(true)}
        />
      )}

      {/* Modales */}
      <StructureModal
        isOpen={structureModal.open}
        onClose={() => setStructureModal({ open: false })}
        tableStructure={db.tableStructure}
      />

      <PreviewModal
        isOpen={previewModal.open}
        onClose={() => setPreviewModal({ open: false })}
        tablePreview={db.tablePreview}
        isReadOnly={db.isReadOnly}
        onAdd={handleOpenAdd}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
      />

      <CrudFormModal
        isOpen={addModal.open}
        onClose={() => setAddModal({ open: false })}
        title={`Agregar registro a ${db.selectedTable}`}
        tableColumns={db.tableColumns}
        tablePk={db.tablePk}
        formData={formData}
        loading={db.crudLoading}
        onFormChange={handleFormChange}
        onSubmit={handleCreate}
        isEdit={false}
      />

      <CrudFormModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, row: null })}
        title={`Editar registro de ${db.selectedTable}`}
        tableColumns={db.tableColumns}
        tablePk={db.tablePk}
        formData={formData}
        editRow={editModal.row}
        loading={db.crudLoading}
        onFormChange={handleFormChange}
        onSubmit={handleUpdate}
        isEdit={true}
      />

      <DeleteModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, row: null })}
        row={deleteModal.row}
        loading={db.crudLoading}
        onDelete={() => handleDelete(false)}
        onSoftDelete={() => handleDelete(true)}
      />

      <StatsModal
        isOpen={statsModal.open}
        onClose={() => setStatsModal({ open: false, table: null })}
        tableName={statsModal.table}
        tableStats={db.tableStats}
      />

      <AuditModal
        isOpen={auditModal.open}
        onClose={() => setAuditModal({ open: false })}
        auditLogs={db.auditLogs}
      />

      <ConnectionsModal
        isOpen={connectionsModal.open}
        onClose={() => setConnectionsModal({ open: false })}
        connections={db.connections}
      />

      <ImportExcelModal
        isOpen={importExcelModal}
        onClose={() => setImportExcelModal(false)}
        onSuccess={() => {
          setTempModeActive(true);
          setImportExcelModal(false);
        }}
      />
    </div>
  );
}
