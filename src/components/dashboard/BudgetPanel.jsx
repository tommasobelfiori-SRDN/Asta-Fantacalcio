import { useStore } from '../../store.js'
import {
  getMySquad,
  getCreditsSpent,
  getCreditsRemaining,
  getSlotsFilledByRole,
  getSlotsRemainingByRole,
  getTotalSlotsRemaining,
  computeMaxRecommendedBudget,
} from '../../lib/engine.js'

export default function BudgetPanel() {
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)

  const mySquad = getMySquad(draftByPlayerId)
  const spent = getCreditsSpent(mySquad)
  const remaining = getCreditsRemaining(leagueConfig, mySquad)
  const filled = getSlotsFilledByRole(mySquad)
  const remainingByRole = getSlotsRemainingByRole(leagueConfig, filled)
  const totalSlotsRemaining = getTotalSlotsRemaining(remainingByRole)
  const maxBudget = computeMaxRecommendedBudget(remaining, totalSlotsRemaining)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="font-mono text-[38px] font-semibold leading-none text-ink">{remaining}</div>
          <div className="text-[10px] font-semibold uppercase tracking-caps text-muted">Crediti rimasti</div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="font-mono text-[38px] font-semibold leading-none text-muted">{spent}</div>
          <div className="text-[10px] font-semibold uppercase tracking-caps text-muted">Crediti spesi</div>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 border-y-2 border-ink px-0.5 py-2.5">
        {maxBudget.complete ? (
          <span className="text-[11px] font-bold uppercase tracking-caps text-campo">Rosa completa</span>
        ) : (
          <>
            <span className="text-[11px] font-bold uppercase tracking-caps text-campo">
              Tetto prossimo acquisto
              {maxBudget.capped && <span className="ml-1.5 text-granata">· budget in tensione</span>}
            </span>
            <span className="font-mono text-2xl font-semibold text-campo">{maxBudget.value} cr</span>
          </>
        )}
      </div>
    </div>
  )
}
