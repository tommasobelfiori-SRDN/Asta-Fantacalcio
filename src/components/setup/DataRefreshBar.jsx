import { useStore } from '../../store.js'
import { formatRelativeTime } from '../../lib/format.js'

export default function DataRefreshBar() {
  const fetchQuotazioni = useStore((s) => s.fetchQuotazioni)
  const playersLoading = useStore((s) => s.playersLoading)
  const playersError = useStore((s) => s.playersError)
  const playersUpdatedAt = useStore((s) => s.playersUpdatedAt)
  const playersCount = useStore((s) => s.players.length)

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => fetchQuotazioni()}
        disabled={playersLoading}
        className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {playersLoading ? 'Aggiornamento in corso…' : 'Aggiorna quotazioni'}
      </button>
      <div className="text-center text-xs text-slate-400">
        {playersUpdatedAt
          ? `${formatRelativeTime(playersUpdatedAt)} · ${playersCount} calciatori`
          : 'Quotazioni non ancora caricate'}
      </div>
      {playersError && (
        <div className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{playersError}</div>
      )}
    </div>
  )
}
