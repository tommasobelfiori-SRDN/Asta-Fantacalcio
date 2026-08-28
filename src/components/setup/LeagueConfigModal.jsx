import { useState } from 'react'
import { useStore } from '../../store.js'
import { CLASSIC_ROLES, ROLE_LABELS_PLURAL } from '../../lib/roles.js'
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

  const inputClasses =
    'rounded-[2px] border-[1.5px] border-ink bg-transparent px-3 py-1.5 font-mono text-[15px] focus:border-campo focus:outline-none'

  return (
    <Modal title="Impostazioni lega" onClose={() => setShowLeagueConfigModal(false)}>
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-caps text-ink">Crediti totali</span>
          <input
            type="number"
            min="1"
            value={draft.totalCredits}
            onChange={(e) => setDraft((d) => ({ ...d, totalCredits: e.target.value }))}
            className={inputClasses}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          {CLASSIC_ROLES.map((role) => {
            const belowFilled = Number(draft.roles[role]) < (filled[role] || 0)
            return (
              <label key={role} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-caps text-ink">
                  {role} · {ROLE_LABELS_PLURAL[role]}
                </span>
                <input
                  type="number"
                  min="0"
                  value={draft.roles[role]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, roles: { ...d.roles, [role]: e.target.value } }))
                  }
                  className={belowFilled ? inputClasses.replace('border-ink', 'border-ocra') : inputClasses}
                />
                {belowFilled && (
                  <span className="text-xs text-ocra">Hai già {filled[role]} giocatori qui</span>
                )}
              </label>
            )
          })}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-hair pt-4">
          <button
            type="button"
            onClick={() => setShowLeagueConfigModal(false)}
            className="h-9 rounded-[2px] border-[1.5px] border-ink px-4 text-[11px] font-bold uppercase tracking-caps text-ink hover:bg-ink/5"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="h-9 rounded-[2px] bg-ink px-5 text-[11px] font-bold uppercase tracking-caps text-paper shadow-press hover:opacity-90"
          >
            Salva
          </button>
        </div>
      </form>
    </Modal>
  )
}
