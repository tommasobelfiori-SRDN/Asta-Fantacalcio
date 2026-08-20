import { useEffect } from 'react'
import { useStore } from '../../store.js'

export default function UndoToast() {
  const lastAction = useStore((s) => s.lastAction)
  const undoLastAction = useStore((s) => s.undoLastAction)
  const clearLastAction = useStore((s) => s.clearLastAction)

  useEffect(() => {
    if (!lastAction) return
    const timer = setTimeout(() => clearLastAction(), 5000)
    return () => clearTimeout(timer)
  }, [lastAction, clearLastAction])

  if (!lastAction) return null

  return (
    <div className="fixed bottom-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-4">
      <span>{lastAction.label}</span>
      <button onClick={undoLastAction} className="font-semibold text-emerald-400 hover:text-emerald-300">
        Annulla
      </button>
    </div>
  )
}
