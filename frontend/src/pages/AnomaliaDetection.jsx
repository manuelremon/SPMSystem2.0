import React, { useState, useCallback } from 'react'
import { useI18n } from '../context/i18n'
import { getAnomalias } from '../services/ai'
import api from '../services/api'

export default function AnomaliaDetection() {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [centro, setCentro] = useState('')
  const [dias, setDias] = useState(90)
  const [loading, setLoading] = useState(false)
  const [anomalias, setAnomalias] = useState(null)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  const searchMateriales = useCallback(async (q) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await api.get('/ai/materiales/buscar-consumo', { params: { q, limit: 10 } })
      setSearchResults(res.data?.data || [])
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }, [])

  const handleSearch = useCallback((e) => {
    const v = e.target.value
    setSearchQuery(v)
    searchMateriales(v)
  }, [searchMateriales])

  const selectMaterial = useCallback((mat) => {
    setSelectedMaterial(mat)
    setSearchQuery(mat.codigo + ' - ' + (mat.descripcion || ''))
    setSearchResults([])
  }, [])

  const detectar = useCallback(async () => {
    if (!selectedMaterial) return
    setLoading(true)
    setError('')
    setAnomalias(null)
    try {
      const result = await getAnomalias(selectedMaterial.codigo, { centro, dias })
      setAnomalias(result)
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Error al detectar anomalias')
    } finally { setLoading(false) }
  }, [selectedMaterial, centro, dias])

  const getSeverityColor = (score) => {
    if (score >= 0.8) return 'var(--error)'
    if (score >= 0.6) return 'var(--warning)'
    return 'var(--info)'
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
        {t('anomalias_title', 'Deteccion de Anomalias')}
      </h1>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 24, fontSize: 14 }}>
        {t('anomalias_desc', 'Identifica patrones inusuales de consumo usando Isolation Forest (ML).')}
      </p>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Material</label>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Buscar por codigo o descripcion..."
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontSize: 14, background: 'var(--bg-base)' }}
          />
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-base)', border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
              {searchResults.map(mat => (
                <div key={mat.codigo} onClick={() => selectMaterial(mat)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-soft)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 600 }}>{mat.codigo}</span>
                  <span style={{ color: 'var(--fg-muted)', marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.descripcion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Centro</label>
          <input type="text" value={centro} onChange={e => setCentro(e.target.value)} placeholder="Ej: AA101"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontSize: 14, background: 'var(--bg-base)' }} />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dias</label>
          <select value={dias} onChange={e => setDias(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontSize: 14, background: 'var(--bg-base)' }}>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>180 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </div>
        <button onClick={detectar} disabled={!selectedMaterial || loading}
          style={{ padding: '8px 24px', background: loading ? 'var(--fg-muted)' : 'var(--primary)', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', height: 38 }}>
          {loading ? 'Analizando...' : 'Detectar'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', marginBottom: 24, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {anomalias && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>Total Registros</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{anomalias.total_registros}</div>
            </div>
            <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>Anomalias Detectadas</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--error)' }}>{anomalias.anomalias_detectadas}</div>
            </div>
            <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>Proporcion</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{(anomalias.proporcion_anomalias * 100).toFixed(1)}%</div>
            </div>
            <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>Significativas</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{anomalias.anomalias_significativas}</div>
            </div>
          </div>

          {/* Anomalies timeline */}
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Anomalias Detectadas</h2>
          {anomalias.explicaciones?.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
              No se detectaron anomalias significativas en el periodo analizado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {anomalias.explicaciones?.map((exp, i) => (
                <div key={i} style={{ padding: '12px 16px', border: '1px solid var(--border)', borderLeft: `4px solid ${getSeverityColor(exp.score)}`, background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{exp.fecha?.split('T')[0] || exp.fecha}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: getSeverityColor(exp.score), color: 'white', textTransform: 'uppercase' }}>
                        Score: {(exp.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {exp.tipos_anomalia?.map((tipo, j) => (
                        <span key={j} style={{ display: 'inline-block', marginRight: 8, marginBottom: 4, padding: '2px 8px', background: 'var(--bg-soft)', border: '1px solid var(--border)', fontSize: 12 }}>
                          {tipo}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Cantidad</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{exp.cantidad?.toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
