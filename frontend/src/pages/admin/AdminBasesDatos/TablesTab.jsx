/**
 * TablesTab - Explorador de tablas de BD
 */

import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import { useI18n } from "../../../context/i18n";
import {
  RefreshCcw,
  FileText,
  Search,
  Download,
} from "../../../components/ui/Icons";

export function TablesTab({
  loading,
  databases,
  selectedDb,
  onDbChange,
  tables,
  onRefresh,
  onViewStructure,
  onViewData,
  onExportCsv,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select
            value={selectedDb}
            onChange={(e) => onDbChange(e.target.value)}
            label={t("db_select", "Base de datos")}
          >
            {databases.map((db) => (
              <option key={db.name} value={db.name}>{db.name}</option>
            ))}
          </Select>
        </div>
        <Button variant="ghost" onClick={onRefresh} disabled={loading}>
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
                        <Button size="sm" variant="ghost" onClick={() => onViewStructure(table.name)}>
                          <FileText className="w-4 h-4" />
                          Estructura
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onViewData(table.name)}>
                          <Search className="w-4 h-4" />
                          Ver datos
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onExportCsv(table.name)}>
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
  );
}
