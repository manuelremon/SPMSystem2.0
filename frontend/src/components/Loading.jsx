import { Loader2 } from './ui/Icons'

/**
 * Loading Component - Glass Morphism Style
 * Full-screen loading indicator with translucent background
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-100 via-slate-100 to-pink-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-glass">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400 font-medium">Cargando...</p>
      </div>
    </div>
  )
}
