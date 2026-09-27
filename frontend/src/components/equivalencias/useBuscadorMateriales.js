import { useCallback, useRef, useState } from 'react'
import { equivalencias } from '../../services/spm'

let secuencia = 0
const nuevoId = () => `msg-${Date.now()}-${secuencia++}`

/**
 * Estado del buscador conversacional de materiales.
 * El historial vive solo en memoria mientras la pagina esta abierta.
 */
export function useBuscadorMateriales() {
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(false)
  const enCurso = useRef(false)

  const consultar = useCallback(async (consulta) => {
    enCurso.current = true
    setCargando(true)
    try {
      const res = await equivalencias.asistente(consulta)
      setMensajes((prev) => [...prev, { id: nuevoId(), rol: 'bot', respuesta: res.data }])
    } catch (err) {
      const error = err?.response?.status === 429 ? 'rate_limit' : 'error'
      setMensajes((prev) => [...prev, { id: nuevoId(), rol: 'bot', error, consulta }])
    } finally {
      enCurso.current = false
      setCargando(false)
    }
  }, [])

  const enviar = useCallback(async (texto) => {
    const consulta = (texto || '').trim()
    if (!consulta || enCurso.current) return
    setMensajes((prev) => [...prev, { id: nuevoId(), rol: 'usuario', texto: consulta }])
    await consultar(consulta)
  }, [consultar])

  const reintentar = useCallback(async (consulta) => {
    if (enCurso.current) return
    setMensajes((prev) => {
      const ultimo = prev[prev.length - 1]
      return ultimo?.error ? prev.slice(0, -1) : prev
    })
    await consultar(consulta)
  }, [consultar])

  const limpiar = useCallback(() => setMensajes([]), [])

  return { mensajes, cargando, enviar, reintentar, limpiar }
}
