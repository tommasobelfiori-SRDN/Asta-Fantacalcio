import { useStore } from '../../store.js'
import { getMySquad, getSlotsFilledByRole } from '../../lib/engine.js'
import { CLASSIC_ROLES, ROLE_LABELS_PLURAL, ROLE_BADGE_CLASSES, ROLE_FILL_CLASSES } from '../../lib/roles.js'
import Badge from '../common/Badge.jsx'

export default function RosterSlots() {
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)

  const filled = getSlotsFilledByRole(getMySquad(draftByPlayerId))

  return (
    <div className="flex flex-col">
      <div className="border-b border-ink pb-1.5 text-[11px] font-bold uppercase tracking-caps text-ink">
        Slot per ruolo
      </div>
      {CLASSIC_ROLES.map((role, i) => {
        const required = leagueConfig.roles[role] || 0
        const count = filled[role] || 0
        const isLast = i === CLASSIC_ROLES.length - 1
        return (
          <div
            key={role}
            className={`flex items-center gap-2.5 px-0.5 py-2 ${isLast ? '' : 'border-b border-hair'}`}
          >
            <Badge
              className={`h-[22px] w-[22px] text-xs ${count > 0 ? ROLE_FILL_CLASSES[role] : ROLE_BADGE_CLASSES[role]}`}
            >
              {role}
            </Badge>
            <span className="flex-1 text-[13px]">{ROLE_LABELS_PLURAL[role]}</span>
            <span className={`font-mono text-[13px] ${count >= required ? 'font-semibold text-campo' : ''}`}>
              {count}/{required}
            </span>
          </div>
        )
      })}
    </div>
  )
}
