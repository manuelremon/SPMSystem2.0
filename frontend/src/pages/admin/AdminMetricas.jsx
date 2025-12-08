import { useEffect, useState } from 'react'
import { admin } from '../../services/spm'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { BarChart3, TrendingUp } from 'lucide-react'

export default function AdminMetricas() {
  const [data, setData] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    admin.metricas().then((res) => setData(res.data || {})).catch((e) => setError(e.response?.data?.error || e.message))
  }, [])

  const entries = Object.entries(data || {})

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas del Sistema"
        subtitle="Estadísticas y contadores"
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entries.map(([k, v]) => (
          <Card key={k}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{k}</p>
                  <p className="text-3xl font-bold text-slate-800 tabular-nums">{v}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-50/70 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && !error && (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Sin datos disponibles</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
