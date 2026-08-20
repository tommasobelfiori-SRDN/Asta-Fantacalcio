import { useState } from 'react'
import { useStore } from '../../store.js'
import { CLASSIC_ROLES, ROLE_LABELS } from '../../lib/roles.js'
import { getMySquad, getSlotsFilledByRole } from '../../lib/engine.js'
import Modal from '../common/Modal.jsx'

export default function LeagueConfigModal() {
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const setLeagueConfig = useStore((s) => s.setLeagueConfig)
  const setShowLeagueConfigModal = useStore((s) => s.setShowLeagueConfigModal)

  const [draft, setDraft] = useState({
    totalCredits: leagueConfig.totalCredits,
    roles: { ...leagueConfig.roles },
  })

  const filled = getSlotsFilledByRole(getMySquad(draftByPlayerId))

  const handleSave = (e) => {
    e.preventDefault()
    setLeagueConfig({
      totalCredits: Number(draft.totalCredits) || 0,
      roles: Object.fromEntries(CLASSIC_ROLES.map((r) => [r, Number(draft.roles[r]) || 0])),
    })
    setShowLeagueConfigModal(false)
  }

  return (
    <Modal title="Impostazioni lega" onClose={() => setShowLeagueConfigModal(false)}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Crediti totali</span>
          <input
            type="number"
            min="1"
            value={draft.totalCredits}
            onChange={(e) => setDraft((d) => ({ ...d, totalCredits: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          {CLASSIC_ROLES.map((role) => {
            const belowFilled = Number(draft.roles[role]) < (filled[role] || 0)
            return (
              <label key={role} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  {role} — {ROLE_LABELS[role]}
                </span>
                <input
                  type="number"
                  min="0"
                  value={draft.roles[role]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, roles: { ...d.roles, [role]: e.target.value } }))
                  }
                  className={`rounded-md border px-3 py-1.5 focus:outline-none ${
                    belowFilled ? 'border-amber-400' : 'border-slate-300 focus:border-emerald-500'
                  }`}
                />
                {belowFilled && (
                  <span className="text-xs text-amber-600">Hai già {filled[role]} giocatori qui</span>
                )}
              </label>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowLeagueConfigModal(false)}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Salva
          </button>
        </div>
      </form>
    </Modal>
  )
}
