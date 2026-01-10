/**
 * ProcurementDashboard - Dashboard de Procurement SAP
 * Visualizacion de KPIs de requisiciones, ordenes de compra, lead times y cumplimiento
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../context/i18n';
import { procurementService } from '../services/procurement';
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  TrendingUp,
  Upload,
  RefreshCw,
  AlertTriangle,
  Package,
  Users,
  DollarSign,
  BarChart3
} from 'lucide-react';

// Componente Card reutilizable
const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', trend }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`mt-1 text-3xl font-semibold text-${color}-600`}>{value}</p>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        {trend !== undefined && (
          <p className={`mt-1 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}% vs periodo anterior
          </p>
        )}
      </div>
      <div className={`p-3 bg-${color}-100 rounded-full`}>
        <Icon className={`h-6 w-6 text-${color}-600`} />
      </div>
    </div>
  </div>
);

// Componente Gauge para OTIF
const OTIFGauge = ({ value }) => {
  const getColor = (val) => {
    if (val >= 90) return 'text-green-500';
    if (val >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${value}, 100`}
            className={getColor(value)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${getColor(value)}`}>{value}%</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-700">OTIF</p>
      <p className="text-xs text-gray-500">On Time In Full</p>
    </div>
  );
};

// Tabla de proveedores
const TopProveedoresTable = ({ proveedores }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pedidos</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {proveedores.map((p, idx) => (
          <tr key={idx} className="hover:bg-gray-50">
            <td className="px-4 py-3 text-sm text-gray-900">{p.proveedor_nombre || 'Sin nombre'}</td>
            <td className="px-4 py-3 text-sm text-gray-500 text-right">{p.pedidos?.toLocaleString()}</td>
            <td className="px-4 py-3 text-sm text-gray-500 text-right">
              ${(p.valor_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Tabla de cumplimiento
const ComplianceTable = ({ items }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pedidos</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% A Tiempo</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Completas</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% OTIF</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item, idx) => (
          <tr key={idx} className="hover:bg-gray-50">
            <td className="px-4 py-3 text-sm text-gray-900">{item.proveedor_nombre || 'Sin nombre'}</td>
            <td className="px-4 py-3 text-sm text-gray-500 text-right">{item.total_pedidos}</td>
            <td className="px-4 py-3 text-sm text-right">
              <span className={`${item.pct_a_tiempo >= 80 ? 'text-green-600' : item.pct_a_tiempo >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {item.pct_a_tiempo}%
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-right">
              <span className={`${item.pct_completas >= 80 ? 'text-green-600' : item.pct_completas >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {item.pct_completas}%
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-right font-medium">
              <span className={`${item.pct_otif >= 80 ? 'text-green-600' : item.pct_otif >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {item.pct_otif}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Componente principal
export default function ProcurementDashboard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes');
  const [centro, setCentro] = useState('');

  const [kpis, setKpis] = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [importHistory, setImportHistory] = useState([]);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, complianceRes, pipelineRes, historyRes] = await Promise.all([
        procurementService.getKPIs({ periodo, centro: centro || undefined }),
        procurementService.getCompliance({ min_pedidos: 3 }),
        procurementService.getPipeline(),
        procurementService.getImportHistory(5)
      ]);

      setKpis(kpisRes.data);
      setCompliance(complianceRes.data?.items || []);
      setPipeline(pipelineRes.data?.items || []);
      setImportHistory(historyRes.data?.items || []);
    } catch (err) {
      console.error('Error fetching procurement data:', err);
      setError('Error al cargar datos de procurement');
    } finally {
      setLoading(false);
    }
  }, [periodo, centro]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const res = await procurementService.importFile(file);
      alert(`Importacion completada:\n- Insertados: ${res.data.stats?.solpeds_inserted || 0} SOLPEDs\n- Actualizados: ${res.data.stats?.solpeds_updated || 0}`);
      setShowImportModal(false);
      fetchData();
    } catch (err) {
      console.error('Error importing:', err);
      alert('Error durante la importacion: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('procurement_dashboard', 'Procurement Dashboard')}
          </h1>
          <p className="text-sm text-gray-500">
            {t('procurement_subtitle', 'Requisiciones SAP, Ordenes de Compra y KPIs')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro Periodo */}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="mes">Ultimo Mes</option>
            <option value="trimestre">Ultimo Trimestre</option>
            <option value="anio">Ultimo Anio</option>
          </select>

          {/* Boton Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Boton Import */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Importar ZM65
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* KPIs Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Requisiciones (SOLPEDs)"
            value={kpis.totales?.solpeds?.toLocaleString() || 0}
            subtitle={`${kpis.totales?.items || 0} items totales`}
            icon={ShoppingCart}
            color="blue"
          />
          <StatCard
            title="Lead Time Promedio"
            value={`${kpis.lead_times?.total_dias || 0} dias`}
            subtitle={`Aprobacion: ${kpis.lead_times?.aprobacion_dias || 0}d | Entrega: ${kpis.lead_times?.entrega_dias || 0}d`}
            icon={Clock}
            color="purple"
          />
          <StatCard
            title="Entregas a Tiempo"
            value={`${kpis.cumplimiento?.pct_a_tiempo || 0}%`}
            subtitle={`OTIF: ${kpis.cumplimiento?.pct_otif || 0}%`}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Proveedores Activos"
            value={kpis.totales?.proveedores_unicos || 0}
            subtitle={`${kpis.totales?.materiales_unicos || 0} materiales unicos`}
            icon={Users}
            color="orange"
          />
        </div>
      )}

      {/* Segunda fila: OTIF Gauge + Top Proveedores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OTIF Gauge */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumplimiento OTIF</h3>
          <div className="flex justify-center">
            <OTIFGauge value={kpis?.cumplimiento?.pct_otif || 0} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{kpis?.cumplimiento?.pct_a_tiempo || 0}%</p>
              <p className="text-xs text-gray-500">A Tiempo</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{kpis?.cumplimiento?.pct_completas || 0}%</p>
              <p className="text-xs text-gray-500">Completas</p>
            </div>
          </div>
        </div>

        {/* Top Proveedores */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Proveedores por Volumen</h3>
          {kpis?.top_proveedores?.length > 0 ? (
            <TopProveedoresTable proveedores={kpis.top_proveedores} />
          ) : (
            <p className="text-gray-500 text-center py-4">No hay datos disponibles</p>
          )}
        </div>
      </div>

      {/* Pipeline */}
      {pipeline.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline de Conversion</h3>
          <div className="flex items-center justify-between">
            {pipeline.map((etapa, idx) => (
              <div key={idx} className="flex-1 text-center">
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full"
                      style={{ width: `${etapa.porcentaje}%` }}
                    />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{etapa.cantidad?.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">{etapa.etapa}</p>
                  <p className="text-xs text-blue-600">{etapa.porcentaje}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla Cumplimiento por Proveedor */}
      {compliance.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumplimiento por Proveedor</h3>
          <ComplianceTable items={compliance.slice(0, 10)} />
        </div>
      )}

      {/* Historial de Importaciones */}
      {importHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ultimas Importaciones</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Archivo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Insertados</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actualizados</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {importHistory.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.filename}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(item.started_at).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{item.records_inserted}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{item.records_updated}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item.status === 'completed' ? 'bg-green-100 text-green-800' :
                        item.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Importacion */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Importar Archivo ZM65</h3>
            <p className="text-sm text-gray-500 mb-4">
              Seleccione un archivo Excel (.xlsx) con datos de requisiciones SAP.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleImport(e.target.files[0]);
                }
              }}
              disabled={importing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {importing && (
              <div className="mt-4 flex items-center gap-2 text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Importando...
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
