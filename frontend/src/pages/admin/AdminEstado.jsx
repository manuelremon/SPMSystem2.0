import { useEffect, useState } from 'react'
import { admin } from '../../services/spm'

export default function AdminEstado() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    admin.estado().then((res) => setData(res.data)).catch((e) => setError(e.response?.data?.error || e.message))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] font-black text-primary-700">Administración</p>
        <h2 className="text-2xl font-black text-black uppercase tracking-[0.05em]">Estado del Sistema</h2>
      </div>
      {error && <div className="bg-danger-50 text-danger-500 px-4 py-3 border-2 border-black font-semibold">{error}</div>}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[var(--bg)] border-4 border-black shadow-[8px_8px_0_0_#000] p-5">
            <h3 className="font-black text-black uppercase tracking-[0.05em] mb-3 text-lg">Servidor</h3>
            <ul className="text-sm text-black space-y-2">
              <li><span className="font-bold">Versión SPM:</span> {data.version_spm}</li>
              <li><span className="font-bold">Python:</span> {data.python_version}</li>
              <li><span className="font-bold">DB Path:</span> {data.db_path}</li>
              <li><span className="font-bold">DB existe:</span> {data.db_exists ? 'Sí' : 'No'}</li>
            </ul>
          </div>
          <div className="bg-[var(--bg)] border-4 border-black shadow-[8px_8px_0_0_#000] p-5">
            <h3 className="font-black text-black uppercase tracking-[0.05em] mb-3 text-lg">Entorno</h3>
            <ul className="text-sm text-black space-y-2">
              {data.env && Object.entries(data.env).map(([k,v]) => (
                <li key={k}><span className="font-bold">{k}:</span> {String(v)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
