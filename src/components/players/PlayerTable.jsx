import { useMemo } from 'react'
import { useStore } from '../../store.js'
import { isPenaltyTaker, hasReliableAverage, countCeduti } from '../../lib/engine.js'
import { formatSeasonShort } from '../../lib/format.js'
import PlayerRow from './PlayerRow.jsx'

export default function PlayerTable() {
  const players = useStore((s) => s.players)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const filters = useStore((s) => s.filters)

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const list = players.filter((p) => {
      // Ceduti fuori dalla Serie A: non si possono comprare, non si mostrano.
      if (p.ceduto) return false
      if (filters.role !== 'all' && p.roleClassic !== filters.role) return false
      if (filters.onlyAvailable && draftByPlayerId[p.id]) return false
      if (filters.onlyPenaltyTakers && !isPenaltyTaker(p)) return false
      // I diffidati giocano: fuori solo chi è davvero fermo.
      if (filters.hideUnavailable && (p.status?.tipo === 'infortunato' || p.status?.tipo === 'squalificato'))
        return false
      if (search && !`${p.name} ${p.team}`.toLowerCase().includes(search)) return false
      return true
    })
    return list.sort((a, b) => {
      if (filters.sortBy === 'nome') return a.name.localeCompare(b.name)
      if (filters.sortBy === 'prezzo') return (b.quotazioneClassicAttuale ?? 0) - (a.quotazioneClassicAttuale ?? 0)
      // Chi non ha giocato in Serie A l'anno scorso finisce in fondo, non in cima.
      // Stessa sorte per le medie su pochissime partite: una fantamedia da 9,50
      // in una sola presenza non regge il confronto con un campionato intero.
      if (filters.sortBy === 'fantamedia') {
        const rank = (p) => (hasReliableAverage(p.prevSeason) ? 1 : 0)
        if (rank(a) !== rank(b)) return rank(b) - rank(a)
        return (b.prevSeason?.fantamedia ?? -1) - (a.prevSeason?.fantamedia ?? -1)
      }
      // I gol fuori dalla Serie A contano, ma non sono confrontabili con quelli
      // del nostro campionato: restano sotto, ordinati fra loro, invece di
      // sparire in fondo insieme a chi non ha giocato affatto.
      if (filters.sortBy === 'gol') {
        const rank = (p) => (p.prevSeason ? 2 : p.prevSeasonAbroad ? 1 : 0)
        if (rank(a) !== rank(b)) return rank(b) - rank(a)
        const gol = (p) => p.prevSeason?.gol ?? p.prevSeasonAbroad?.gol ?? -1
        return gol(b) - gol(a)
      }
      return (b.fvmClassic ?? 0) - (a.fvmClassic ?? 0)
    })
  }, [players, draftByPlayerId, filters])

  const seasonLabel = formatSeasonShort(players.find((p) => p.prevSeason)?.prevSeason?.season)
  const ceduti = countCeduti(players)

  if (players.length === 0) {
    return (
      <div className="border-y-2 border-ink py-10 text-center font-serif text-[15px] italic text-muted">
        Nessuna quotazione caricata. Premi "Aggiorna quotazioni" per iniziare.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline gap-3 border-b border-hair border-t-2 border-t-ink py-2 text-[10px] font-bold uppercase tracking-caps text-muted">
        <span className="flex-1">Listone</span>
        {seasonLabel && <span className="hidden w-[104px] text-right lg:block">FM {seasonLabel}</span>}
        <span className="font-mono normal-case tracking-normal">
          {filtered.length} calciatori
          {ceduti > 0 && <span title="Non più in una rosa di Serie A: esclusi dal listone"> · {ceduti} ceduti esclusi</span>}
        </span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((p) => (
          <PlayerRow key={p.id} player={p} />
        ))}
      </ul>
    </div>
  )
}
