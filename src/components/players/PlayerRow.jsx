import { memo } from 'react'
import { useStore } from '../../store.js'
import { ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import { convenienceRatio, convenienceTier, penaltyRankBadge } from '../../lib/engine.js'
import { formatRatio } from '../../lib/format.js'
import Badge from '../common/Badge.jsx'
import PlayerActionButtons from './PlayerActionButtons.jsx'
import PlayerDetailsButton from './PlayerDetailsButton.jsx'

function PlayerRow({ player }) {
  // Selettore puntuale sulla propria voce: con 500+ righe, un click su UN
  // giocatore non deve ri-renderizzare tutte le altre righe della lista.
  const draftEntry = useStore((s) => s.draftByPlayerId[player.id])
  const ratio = convenienceRatio(player)
  const tier = convenienceTier(player)
  const penaltyBadge = penaltyRankBadge(player)

  const rowClasses = draftEntry
    ? draftEntry.status === 'mine'
      ? 'bg-emerald-50/60'
      : 'bg-slate-50 opacity-60'
    : ''

  return (
    <li className={`flex items-center justify-between gap-3 px-3 py-2.5 ${rowClasses}`}>
      <div className="flex min-w-0 items-center gap-2">
        <Badge className={`shrink-0 ${ROLE_BADGE_CLASSES[player.roleClassic]}`}>{player.roleClassic}</Badge>
        <div className="min-w-0 truncate">
          <div className="truncate font-medium text-slate-800">{player.name}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
            <span className="truncate">
              {player.team} · {player.quotazioneClassicAttuale} cr · FVM {player.fvmClassic}
            </span>
            {tier && (
              <Badge className={`shrink-0 ${tier.className}`}>
                {tier.label} {ratio != null && `(${formatRatio(ratio)}x)`}
              </Badge>
            )}
            {penaltyBadge && <Badge className={`shrink-0 ${penaltyBadge.className}`}>{penaltyBadge.label}</Badge>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <PlayerDetailsButton player={player} />
        <PlayerActionButtons player={player} draftEntry={draftEntry} />
      </div>
    </li>
  )
}

export default memo(PlayerRow)
