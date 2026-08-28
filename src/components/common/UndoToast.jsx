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
    <div className="fixed bottom-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-[2px] bg-ink px-4 py-2.5 text-sm text-paper shadow-press lg:bottom-4">
      <span className="font-serif">{lastAction.label}</span>
      <button
        onClick={undoLastAction}
        className="text-[11px] font-bold uppercase tracking-caps text-[#A9C8B2] hover:text-paper"
      >
        Annulla
      </button>
    </div>
  )
}
