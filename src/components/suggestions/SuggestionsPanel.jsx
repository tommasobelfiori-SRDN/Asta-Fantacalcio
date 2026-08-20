import { useMemo } from 'react'
import { useStore } from '../../store.js'
import { buildSuggestions, penaltyRankBadge } from '../../lib/engine.js'
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import { formatRatio } from '../../lib/format.js'
import Badge from '../common/Badge.jsx'
import PlayerActionButtons from '../players/PlayerActionButtons.jsx'
import PlayerDetailsButton from '../players/PlayerDetailsButton.jsx'

export default function SuggestionsPanel() {
  const players = useStore((s) => s.players)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const leagueConfig = useStore((s) => s.leagueConfig)

  const { maxBudget, sections } = useMemo(
    () => buildSuggestions({ players, draftByPlayerId, leagueConfig }),
    [players, draftByPlayerId, leagueConfig]
  )

  if (players.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
        Nessuna quotazione caricata. Premi "Aggiorna quotazioni" per iniziare.
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center text-sm text-emerald-800">
        Rosa completa — hai riempito tutti gli slot. 🎉
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-center">
        <div className="text-2xl font-bold text-emerald-800">{maxBudget.value} cr</div>
        <div className="text-xs text-emerald-700">budget massimo consigliato per il prossimo acquisto</div>
      </div>

      {sections.map((section) => (
        <div key={section.role} className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <Badge className={ROLE_BADGE_CLASSES[section.role]}>
              {section.role} — {ROLE_LABELS[section.role]}
            </Badge>
            <span className="text-xs text-slate-400">{section.slotsRemaining} slot mancanti</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {section.players.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">Nessun calciatore disponibile per questo ruolo.</li>
            )}
            {section.players.map((p) => {
              const penaltyBadge = penaltyRankBadge(p)
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 truncate">
                      <div className="truncate font-medium text-slate-800">{p.name}</div>
                      <div className="truncate text-xs text-slate-400">
                        {p.team} · FVM {p.fvmClassic} · {p.quotazioneClassicAttuale} cr
                      </div>
                    </div>
                    {p.convenienceTier && (
                      <Badge className={`shrink-0 ${p.convenienceTier.className}`}>
                        {p.convenienceTier.label} {p.convenienceRatio != null && `(${formatRatio(p.convenienceRatio)}x)`}
                      </Badge>
                    )}
                    {penaltyBadge && <Badge className={`shrink-0 ${penaltyBadge.className}`}>{penaltyBadge.label}</Badge>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PlayerDetailsButton player={p} />
                    <PlayerActionButtons player={p} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
