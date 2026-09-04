import { useStore } from '../../store.js'
import { formatRelativeTime } from '../../lib/format.js'
import { countCeduti } from '../../lib/engine.js'

export default function DataRefreshBar() {
  const fetchQuotazioni = useStore((s) => s.fetchQuotazioni)
  const playersLoading = useStore((s) => s.playersLoading)
  const playersError = useStore((s) => s.playersError)
  const playersUpdatedAt = useStore((s) => s.playersUpdatedAt)
  const playersCount = useStore((s) => s.players.length)
  const ceduti = useStore((s) => countCeduti(s.players))

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => fetchQuotazioni()}
        disabled={playersLoading}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[2px] bg-ink text-[13px] font-bold uppercase tracking-caps text-paper shadow-press hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"></path>
          <path d="M13.7 1.8v2.7h-2.7"></path>
        </svg>
        {playersLoading ? 'Aggiornamento…' : 'Aggiorna quotazioni'}
      </button>
      <div className="text-center font-mono text-[11px] text-muted">
        {playersUpdatedAt
          ? `${formatRelativeTime(playersUpdatedAt)} · ${playersCount - ceduti} calciatori${ceduti ? ` · ${ceduti} ceduti` : ''}`
          : 'Quotazioni non ancora caricate'}
      </div>
      {playersError && (
        <div className="border-[1.5px] border-granata px-2.5 py-1.5 text-xs text-granata">{playersError}</div>
      )}
    </div>
  )
}
