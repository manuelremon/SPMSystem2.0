import { useEffect, useState } from 'react'
import { admin } from '../../services/spm'

export default function AdminMetricas() {
  const [data, setData] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    admin.metricas().then((res) => setData(res.data || {})).catch((e) => setError(e.response?.data?.error || e.message))
  }, [])

  const entries = Object.entries(data || {})

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] font-black text-primary-700">Administración</p>
        <h2 className="text-2xl font-black text-black uppercase tracking-[0.05em]">Métricas</h2>
      </div>
      {error && <div className="bg-danger-50 text-danger-500 px-4 py-3 border-2 border-black font-semibold">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entries.map(([k, v]) => (
          <div key={k} className="bg-[var(--bg)] border-4 border-black shadow-[8px_8px_0_0_#000] p-5">
            <p className="text-xs uppercase tracking-[0.08em] font-bold text-black">{k}</p>
            <p className="text-3xl font-black text-black">{v}</p>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="col-span-full text-black font-semibold">Sin datos</div>
        )}
      </div>
    </div>
  )
}
