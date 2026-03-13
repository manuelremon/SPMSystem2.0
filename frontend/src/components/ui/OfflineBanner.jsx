import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--warning-light)',
        color: 'var(--fg-strong)',
        textAlign: 'center',
        padding: 'var(--space-2) var(--space-4)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
      }}
    >
      Sin conexion a internet — Los datos mostrados pueden no estar actualizados
    </div>
  )
}
