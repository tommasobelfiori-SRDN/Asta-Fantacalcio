import { useMemo } from 'react'
import { useStore } from '../../store.js'
import { isPenaltyTaker } from '../../lib/engine.js'
import PlayerRow from './PlayerRow.jsx'

export default function PlayerTable() {
  const players = useStore((s) => s.players)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const filters = useStore((s) => s.filters)

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const list = players.filter((p) => {
      if (filters.role !== 'all' && p.roleClassic !== filters.role) return false
      if (filters.onlyAvailable && draftByPlayerId[p.id]) return false
      if (filters.onlyPenaltyTakers && !isPenaltyTaker(p)) return false
      if (search && !`${p.name} ${p.team}`.toLowerCase().includes(search)) return false
      return true
    })
    return list.sort((a, b) => {
      if (filters.sortBy === 'nome') return a.name.localeCompare(b.name)
      if (filters.sortBy === 'prezzo') return (b.quotazioneClassicAttuale ?? 0) - (a.quotazioneClassicAttuale ?? 0)
      return (b.fvmClassic ?? 0) - (a.fvmClassic ?? 0)
    })
  }, [players, draftByPlayerId, filters])

  if (players.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
        Nessuna quotazione caricata. Premi "Aggiorna quotazioni" per iniziare.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-400">{filtered.length} calciatori</div>
      <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
        {filtered.map((p) => (
          <PlayerRow key={p.id} player={p} />
        ))}
      </ul>
    </div>
  )
}
