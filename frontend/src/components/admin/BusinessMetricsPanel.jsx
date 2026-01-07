/**
 * BusinessMetricsPanel - Panel de metricas de negocio
 *
 * Muestra contadores de solicitudes, usuarios y materiales
 */

import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { FileText, Clock, Users, Package, TrendingUp, CheckCircle } from '../ui/Icons'

/**
 * Tarjeta de metrica individual
 */
function MetricCard({ title, value, icon: Icon, variant = 'default', subtitle }) {
  const variants = {
    default: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
    primary: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  }

  return (
    <div className={`border rounded-lg p-4 ${variants[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium opacity-70 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-2xl font-bold mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs opacity-60 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="opacity-50">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

/**
 * Mini grafico de barras para estados
 */
function EstadosChart({ estados }) {
  if (!estados || Object.keys(estados).length === 0) return null

  const total = Object.values(estados).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  // Colores por estado
  const estadoColors = {
    'Borrador': '#94a3b8',
    'Enviada': '#3b82f6',
    'En Revision': '#f59e0b',
    'En Revisión': '#f59e0b',
    'Aprobada': '#10b981',
    'Rechazada': '#ef4444',
    'En Planificacion': '#8b5cf6',
    'En Planificación': '#8b5cf6',
    'Despachada': '#06b6d4',
    'Cerrada': '#6b7280',
  }

  return (
    <div className="mt-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Distribucion por estado</p>
      <div className="h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-700">
        {Object.entries(estados).map(([estado, count]) => {
          const width = (count / total) * 100
          if (width < 1) return null
          return (
            <div
              key={estado}
              style={{
                width: `${width}%`,
                backgroundColor: estadoColors[estado] || '#94a3b8',
              }}
              title={`${estado}: ${count}`}
              className="h-full"
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(estados).map(([estado, count]) => (
          <span
            key={estado}
            className="text-xs flex items-center gap-1"
            style={{ color: estadoColors[estado] || '#94a3b8' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: estadoColors[estado] || '#94a3b8' }}
            />
            {estado}: {count}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Panel de metricas de negocio
 */
export function BusinessMetricsPanel({ data, isLoading = false }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Metricas de Negocio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-lg" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Metricas de Negocio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">No hay datos disponibles</p>
        </CardContent>
      </Card>
    )
  }

  const { solicitudes = {}, usuarios = {}, materiales = {} } = data

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Metricas de Negocio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Solicitudes Hoy"
            value={solicitudes.hoy || 0}
            icon={FileText}
            variant="primary"
          />
          <MetricCard
            title="Pendientes"
            value={solicitudes.pendientes || 0}
            icon={Clock}
            variant={solicitudes.pendientes > 10 ? 'warning' : 'default'}
            subtitle={solicitudes.pendientes > 10 ? 'Requiere atencion' : null}
          />
          <MetricCard
            title="Usuarios Activos (24h)"
            value={usuarios.activos_24h || 0}
            icon={Users}
            variant="success"
            subtitle={`${usuarios.total || 0} total`}
          />
          <MetricCard
            title="Materiales (Mes)"
            value={materiales.unicos_mes || 0}
            icon={Package}
            subtitle="Unicos solicitados"
          />
        </div>

        {/* Grafico de estados */}
        <EstadosChart estados={solicitudes.por_estado} />

        {/* Resumen */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Total solicitudes:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{solicitudes.total || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default BusinessMetricsPanel
