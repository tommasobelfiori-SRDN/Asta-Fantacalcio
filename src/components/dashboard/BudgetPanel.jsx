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
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <div className="text-2xl font-bold text-slate-900">{remaining}</div>
          <div className="text-xs text-slate-500">crediti rimasti</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{spent}</div>
          <div className="text-xs text-slate-500">crediti spesi</div>
        </div>
      </div>
      <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-center">
        {maxBudget.complete ? (
          <div className="text-sm font-medium text-emerald-800">Rosa completa 🎉</div>
        ) : (
          <>
            <div className="text-lg font-semibold text-emerald-800">{maxBudget.value} cr</div>
            <div className="text-xs text-emerald-700">
              budget massimo consigliato per il prossimo acquisto
              {maxBudget.capped && ' — attenzione, budget già in tensione'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
