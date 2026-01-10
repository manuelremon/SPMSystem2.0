/**
 * ProcurementAnalytics - Analytics de Impacto de Procurement
 * Dashboard consolidado mostrando el impacto del modulo en produccion
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../context/i18n';
import { procurementService } from '../services/procurement';
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Package,
  Users,
  Clock,
  CheckCircle,
  Target,
  ArrowRight,
  Building2,
  Truck,
  FileSpreadsheet
} from 'lucide-react';

// Componente Card con indicador de valor
const MetricCard = ({ title, value, subtitle, icon: Icon, color = 'blue' }) => (
  <div className="bg-white rounded-lg shadow p-5 border-l-4 border-l-blue-500">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`mt-1 text-2xl font-bold text-gray-900`}>{value}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className={`p-2 bg-${color}-100 rounded-lg`}>
        <Icon className={`h-5 w-5 text-${color}-600`} />
      </div>
    </div>
  </div>
);

// Pipeline visual con embudo
const PipelineViz = ({ data }) => {
  if (!data || data.length === 0) return null;

  const colors = ['bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200'];

  return (
    <div className="space-y-3">
      {data.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-28 text-sm text-gray-600 text-right">{item.etapa}</div>
          <div className="flex-1 relative">
            <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[idx] || 'bg-blue-500'} rounded-full flex items-center justify-end pr-3`}
                style={{ width: `${Math.max(item.porcentaje, 5)}%` }}
              >
                <span className="text-white text-xs font-medium">{item.porcentaje}%</span>
              </div>
            </div>
          </div>
          <div className="w-20 text-sm font-semibold text-gray-900 text-right">
            {item.cantidad?.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

// OTIF Gauge mejorado
const OTIFGaugeCard = ({ data }) => {
  const objetivo = data?.objetivo_otif || 85;
  const actual = data?.pct_otif || 0;
  const aTiempo = data?.pct_a_tiempo || 0;
  const completas = data?.pct_completas || 0;

  const getColor = (val) => {
    if (val >= 85) return 'text-green-500';
    if (val >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBgColor = (val) => {
    if (val >= 85) return 'stroke-green-500';
    if (val >= 70) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Cumplimiento OTIF</h3>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Target className="h-4 w-4" />
          Objetivo: {objetivo}%
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              className={getBgColor(actual)}
              strokeWidth="3"
              strokeDasharray={`${actual}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${getColor(actual)}`}>{actual}%</span>
            <span className="text-xs text-gray-500">OTIF</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className={`text-xl font-bold ${aTiempo >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
            {aTiempo}%
          </p>
          <p className="text-xs text-gray-500">A Tiempo</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className={`text-xl font-bold ${completas >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
            {completas}%
          </p>
          <p className="text-xs text-gray-500">Completas</p>
        </div>
      </div>
    </div>
  );
};

// Tabla de proveedores
const ProveedoresTable = ({ title, data, columns }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {columns.map((col, cidx) => (
                <td key={cidx} className={`px-4 py-3 text-sm ${col.align === 'right' ? 'text-right' : ''} ${col.className || 'text-gray-900'}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Centro distribution
const CentrosChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const maxSolpeds = Math.max(...data.map(d => d.total_solpeds || 0));

  return (
    <div className="space-y-3">
      {data.map((centro, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-16 text-sm font-medium text-gray-700">{centro.centro}</div>
          <div className="flex-1">
            <div className="h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded"
                style={{ width: `${(centro.total_solpeds / maxSolpeds) * 100}%` }}
              />
            </div>
          </div>
          <div className="w-24 text-right">
            <span className="text-sm font-semibold text-gray-900">{centro.total_solpeds}</span>
            <span className="text-xs text-gray-500 ml-1">solpeds</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Componente principal
export default function ProcurementAnalytics() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await procurementService.getAnalytics();
      setAnalytics(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Error al cargar analytics de procurement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Cargando analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('procurement_analytics', 'Analítica de Compras SAP')}
          </h1>
          <p className="text-sm text-gray-500">
            Impacto del módulo de compras en producción
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Actualizado: {lastUpdated.toLocaleTimeString('es-AR')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {analytics && (
        <>
          {/* Metricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total SOLPEDs"
              value={analytics.volumenes?.solpeds?.toLocaleString() || 0}
              subtitle={`${analytics.volumenes?.materiales || 0} materiales únicos`}
              icon={Package}
              color="blue"
            />
            <MetricCard
              title="Órdenes de Compra"
              value={analytics.volumenes?.orders?.toLocaleString() || 0}
              subtitle={`${analytics.volumenes?.recibidos || 0} recibidos`}
              icon={Truck}
              color="green"
            />
            <MetricCard
              title="Proveedores"
              value={analytics.volumenes?.proveedores || 0}
              subtitle={`${analytics.cumplimiento?.proveedores_evaluados || 0} evaluados`}
              icon={Users}
              color="purple"
            />
            <MetricCard
              title="Tiempo de Entrega Promedio"
              value={`${analytics.lead_times?.promedio || 0} días`}
              subtitle={`Mín: ${analytics.lead_times?.minimo || 0}d | Máx: ${analytics.lead_times?.maximo || 0}d`}
              icon={Clock}
              color="orange"
            />
          </div>

          {/* Segunda fila: Pipeline + OTIF */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Embudo de Conversión</h3>
              </div>
              <PipelineViz data={analytics.pipeline} />
            </div>

            {/* OTIF Gauge */}
            <OTIFGaugeCard data={analytics.cumplimiento} />
          </div>

          {/* Tercera fila: Top Proveedores + Mas Rapidos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top por volumen */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Top Proveedores por Volumen</h3>
              </div>
              <ProveedoresTable
                data={analytics.top_proveedores_volumen}
                columns={[
                  { key: 'proveedor_nombre', header: 'Proveedor', render: (v) => v || 'Sin nombre' },
                  { key: 'total_pedidos', header: 'Pedidos', align: 'right' },
                  { key: 'pct_completas', header: '% Completas', align: 'right', render: (v) => `${v || 0}%` }
                ]}
              />
            </div>

            {/* Mas rapidos */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Proveedores Más Rápidos</h3>
              </div>
              <ProveedoresTable
                data={analytics.proveedores_mas_rapidos}
                columns={[
                  { key: 'proveedor_nombre', header: 'Proveedor', render: (v) => v || 'Sin nombre' },
                  { key: 'entregas', header: 'Entregas', align: 'right' },
                  { key: 'lead_time_promedio', header: 'Tiempo Entrega', align: 'right', render: (v) => `${v || 0} días` }
                ]}
              />
            </div>
          </div>

          {/* Cuarta fila: Centros + Info importacion */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Distribucion por centro */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Distribución por Centro</h3>
              </div>
              <CentrosChart data={analytics.distribucion_centros} />
            </div>

            {/* Info de importacion */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Importaciones</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">Total importaciones</span>
                  <span className="font-semibold">{analytics.importaciones?.total || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">Registros insertados</span>
                  <span className="font-semibold">{analytics.importaciones?.registros_insertados?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-500">Errores</span>
                  <span className={`font-semibold ${analytics.importaciones?.errores > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {analytics.importaciones?.errores || 0}
                  </span>
                </div>
                {analytics.importaciones?.ultima && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500">Última importación</span>
                    <span className="text-sm text-gray-700">
                      {new Date(analytics.importaciones.ultima).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Resumen de valor */}
          {analytics.volumenes?.valor_total > 0 && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Valor Total de Órdenes</p>
                  <p className="text-3xl font-bold mt-1">
                    ${analytics.volumenes.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-80">Centros activos</p>
                  <p className="text-3xl font-bold mt-1">{analytics.volumenes?.centros || 0}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
