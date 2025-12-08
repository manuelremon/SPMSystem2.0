import { useEffect, useState } from 'react'
import { admin } from '../../services/spm'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Server, Database, Settings } from 'lucide-react'

export default function AdminEstado() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    admin.estado().then((res) => setData(res.data)).catch((e) => setError(e.response?.data?.error || e.message))
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estado del Sistema"
        subtitle="Información del servidor y entorno"
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                Servidor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Versión SPM</span>
                  <span className="font-medium">{data.version_spm}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Python</span>
                  <span className="font-medium">{data.python_version}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">DB Path</span>
                  <span className="font-medium text-xs truncate max-w-[200px]">{data.db_path}</span>
                </li>
                <li className="flex justify-between py-1">
                  <span className="text-slate-500">DB existe</span>
                  <span className={`font-medium ${data.db_exists ? 'text-emerald-600' : 'text-red-600'}`}>
                    {data.db_exists ? 'Sí' : 'No'}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Entorno
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-700 space-y-2">
                {data.env && Object.entries(data.env).map(([k, v]) => (
                  <li key={k} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-medium">{String(v)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
