import { memo } from 'react'
import { useStore } from '../../store.js'
import { ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import { convenienceRatio, convenienceTier, penaltyRankBadge } from '../../lib/engine.js'
import { formatRatio } from '../../lib/format.js'
import Badge, { PenaltyMedallion, ConvenienceTag } from '../common/Badge.jsx'
import PlayerActionButtons from './PlayerActionButtons.jsx'
import PlayerDetailsButton from './PlayerDetailsButton.jsx'
import PrevSeasonStat, { PrevSeasonInline } from './PrevSeasonStat.jsx'

function PlayerRow({ player }) {
  // Selettore puntuale sulla propria voce: con 500+ righe, un click su UN
  // giocatore non deve ri-renderizzare tutte le altre righe della lista.
  const draftEntry = useStore((s) => s.draftByPlayerId[player.id])
  const ratio = convenienceRatio(player)
  const tier = convenienceTier(player)
  const penaltyBadge = penaltyRankBadge(player)

  const isMine = draftEntry?.status === 'mine'
  const isTaken = draftEntry?.status === 'taken'

  return (
    <li
      className={`flex items-center gap-3 border-b border-hair px-1 py-2.5 ${
        isMine ? 'bg-campo/[0.07]' : isTaken ? 'opacity-45' : ''
      }`}
    >
      <Badge className={`h-[26px] w-[26px] text-[13px] ${ROLE_BADGE_CLASSES[player.roleClassic]}`}>
        {player.roleClassic}
      </Badge>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`truncate font-serif text-lg font-medium leading-tight text-ink ${isTaken ? 'line-through' : ''}`}
          >
            {player.name}
          </span>
          <PenaltyMedallion badge={penaltyBadge} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted">
          <span>
            {player.team} · {player.quotazioneClassicAttuale} cr · FVM {player.fvmClassic}
            <span className="lg:hidden">
              <PrevSeasonInline stat={player.prevSeason} />
            </span>
          </span>
          {isTaken ? (
            <span className="font-sans text-[11px] font-bold uppercase tracking-caps">Preso da un avversario</span>
          ) : (
            <ConvenienceTag tier={tier} ratioText={formatRatio(ratio)} />
          )}
        </div>
      </div>
      <PrevSeasonStat stat={player.prevSeason} season={player.prevSeason?.season} />
      <div className="flex shrink-0 items-center gap-2">
        <PlayerDetailsButton player={player} />
        <PlayerActionButtons player={player} draftEntry={draftEntry} />
      </div>
    </li>
  )
}

export default memo(PlayerRow)
