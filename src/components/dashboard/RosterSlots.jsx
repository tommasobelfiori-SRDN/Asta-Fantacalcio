import { useStore } from '../../store.js'
import { getMySquad, getSlotsFilledByRole, getSlotsRemainingByRole } from '../../lib/engine.js'
import { CLASSIC_ROLES, ROLE_LABELS, ROLE_BADGE_CLASSES } from '../../lib/roles.js'

export default function RosterSlots() {
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)

  const mySquad = getMySquad(draftByPlayerId)
  const filled = getSlotsFilledByRole(mySquad)
  const remaining = getSlotsRemainingByRole(leagueConfig, filled)

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Slot per ruolo</div>
      <div className="grid grid-cols-4 gap-2">
        {CLASSIC_ROLES.map((role) => {
          const required = leagueConfig.roles[role] || 0
          const isComplete = remaining[role] === 0
          return (
            <div
              key={role}
              title={ROLE_LABELS[role]}
              className={`rounded-md border px-2 py-2 text-center ${ROLE_BADGE_CLASSES[role]} ${
                isComplete ? 'opacity-60' : ''
              }`}
            >
              <div className="text-sm font-bold">{role}</div>
              <div className="text-xs">
                {filled[role]}/{required}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
