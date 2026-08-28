import { useMemo } from 'react'
import { useStore } from '../../store.js'
import { buildSuggestions, penaltyRankBadge } from '../../lib/engine.js'
import { ROLE_LABELS_PLURAL, ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import { formatRatio } from '../../lib/format.js'
import Badge, { PenaltyMedallion, ConvenienceTag } from '../common/Badge.jsx'
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
      <div className="border-y-2 border-ink py-10 text-center font-serif text-[15px] italic text-muted">
        Nessuna quotazione caricata. Premi "Aggiorna quotazioni" per iniziare.
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="border-2 border-campo py-10 text-center">
        <span className="text-[13px] font-bold uppercase tracking-caps text-campo">
          Rosa completa — tutti gli slot riempiti
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-baseline justify-center gap-x-3.5 gap-y-1 border-b-2 border-campo pb-4 pt-1">
        <span className="text-[13px] font-bold uppercase tracking-caps text-campo">Tetto prossimo acquisto</span>
        <span className="font-mono text-[40px] font-semibold leading-none text-campo">{maxBudget.value} cr</span>
      </div>

      {sections.map((section) => (
        <div key={section.role} className="flex flex-col">
          <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
            <span className="flex items-center gap-2.5">
              <Badge className={`h-6 w-6 text-[13px] ${ROLE_BADGE_CLASSES[section.role]}`}>{section.role}</Badge>
              <span className="text-[13px] font-extrabold uppercase tracking-caps text-ink">
                {ROLE_LABELS_PLURAL[section.role]}
              </span>
            </span>
            <span className="font-mono text-xs text-muted">
              {section.slotsRemaining} slot mancant{section.slotsRemaining === 1 ? 'e' : 'i'}
            </span>
          </div>
          {section.players.length === 0 && (
            <p className="px-1 py-3 font-serif text-sm italic text-muted">
              Nessun calciatore disponibile per questo ruolo.
            </p>
          )}
          <ul>
            {section.players.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 px-1 py-2.5 ${
                  i === section.players.length - 1 ? '' : 'border-b border-hair'
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-serif text-lg font-medium leading-tight text-ink">{p.name}</span>
                    <PenaltyMedallion badge={penaltyRankBadge(p)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted">
                    <span>
                      {p.team} · {p.quotazioneClassicAttuale} cr · FVM {p.fvmClassic}
                    </span>
                    <ConvenienceTag tier={p.convenienceTier} ratioText={formatRatio(p.convenienceRatio)} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PlayerDetailsButton player={p} />
                  <PlayerActionButtons player={p} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
