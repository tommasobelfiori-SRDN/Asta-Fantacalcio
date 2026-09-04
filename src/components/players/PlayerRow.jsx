import { memo } from 'react'
import { useStore, useOpponentName } from '../../store.js'
import { ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import { convenienceRatio, convenienceTier, penaltyRankBadge } from '../../lib/engine.js'
import { formatRatio } from '../../lib/format.js'
import Badge, { PenaltyMedallion, ConvenienceTag, StatusMedallion } from '../common/Badge.jsx'
import PlayerActionButtons from './PlayerActionButtons.jsx'
import PlayerDetailsButton from './PlayerDetailsButton.jsx'
import PrevSeasonStat, { PrevSeasonInline } from './PrevSeasonStat.jsx'

function PlayerRow({ player }) {
  // Selettori puntuali sulla propria voce: con 500+ righe, un click su UN
  // giocatore non deve ri-renderizzare tutte le altre righe della lista.
  const draftEntry = useStore((s) => s.draftByPlayerId[player.id])
  const isSelected = useStore((s) => s.selectedPlayerId === player.id)
  const selectPlayer = useStore((s) => s.selectPlayer)
  const ownerName = useOpponentName(draftEntry?.ownerId)
  const ratio = convenienceRatio(player)
  const tier = convenienceTier(player)
  const penaltyBadge = penaltyRankBadge(player)

  const isMine = draftEntry?.status === 'mine'
  const isTaken = draftEntry?.status === 'taken'

  return (
    <li
      onClick={() => selectPlayer(player)}
      className={`flex cursor-pointer items-center gap-3 border-b border-hair px-1 py-2.5 ${
        isSelected ? 'bg-ink/[0.06] ring-1 ring-inset ring-ink/25' : 'hover:bg-ink/[0.03]'
      } ${isMine ? 'bg-campo/[0.07]' : isTaken ? 'opacity-45' : ''}`}
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
          <StatusMedallion status={player.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted">
          <span>
            {player.team} · {player.quotazioneClassicAttuale} cr · FVM {player.fvmClassic}
            <span className="lg:hidden">
              <PrevSeasonInline
                stat={player.prevSeason}
                abroad={player.prevSeasonAbroad}
                role={player.roleClassic}
              />
            </span>
          </span>
          {isTaken ? (
            <span className="font-sans text-[11px] font-bold uppercase tracking-caps">
              {ownerName ? `Preso da ${ownerName}` : 'Preso da un avversario'}
              {draftEntry.price != null && ` · ${draftEntry.price} cr`}
            </span>
          ) : (
            <ConvenienceTag tier={tier} ratioText={formatRatio(ratio)} />
          )}
        </div>
      </div>
      <PrevSeasonStat
        stat={player.prevSeason}
        abroad={player.prevSeasonAbroad}
        season={player.prevSeason?.season}
        role={player.roleClassic}
      />
      {/* Il click sulle azioni non deve cambiare anche la selezione del pannello. */}
      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {/* Su schermi larghi i dettagli stanno nel pannello: la finestra serve solo sotto. */}
        <span className="xl:hidden">
          <PlayerDetailsButton player={player} />
        </span>
        <PlayerActionButtons player={player} draftEntry={draftEntry} />
      </div>
    </li>
  )
}

export default memo(PlayerRow)
