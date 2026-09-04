import { useState } from 'react'
import { useStore } from '../../store.js'
import { CLASSIC_ROLES, ROLE_LABELS_PLURAL } from '../../lib/roles.js'
import { getMySquad, getSlotsFilledByRole, getTakenEntries } from '../../lib/engine.js'
import Modal from '../common/Modal.jsx'

// Id corti e casuali: sopravvivono a rinomina e riordino, così gli acquisti
// restano agganciati alla squadra giusta.
const newOpponentId = () => `sq-${Math.random().toString(36).slice(2, 8)}`

export default function LeagueConfigModal() {
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const setLeagueConfig = useStore((s) => s.setLeagueConfig)
  const setShowLeagueConfigModal = useStore((s) => s.setShowLeagueConfigModal)

  const [draft, setDraft] = useState({
    totalCredits: leagueConfig.totalCredits,
    roles: { ...leagueConfig.roles },
    opponents: leagueConfig.opponents.map((o) => ({ ...o })),
  })
  const [focusId, setFocusId] = useState(null)

  const filled = getSlotsFilledByRole(getMySquad(draftByPlayerId))
  const takenByOwner = {}
  for (const entry of getTakenEntries(draftByPlayerId)) {
    if (entry.ownerId) takenByOwner[entry.ownerId] = (takenByOwner[entry.ownerId] || 0) + 1
  }

  const addOpponent = () => {
    const id = newOpponentId()
    setDraft((d) => ({ ...d, opponents: [...d.opponents, { id, name: '' }] }))
    setFocusId(id)
  }
  const renameOpponent = (id, name) =>
    setDraft((d) => ({ ...d, opponents: d.opponents.map((o) => (o.id === id ? { ...o, name } : o)) }))
  const removeOpponent = (id) =>
    setDraft((d) => ({ ...d, opponents: d.opponents.filter((o) => o.id !== id) }))

  const handleSave = (e) => {
    e.preventDefault()
    setLeagueConfig({
      totalCredits: Number(draft.totalCredits) || 0,
      roles: Object.fromEntries(CLASSIC_ROLES.map((r) => [r, Number(draft.roles[r]) || 0])),
      // Le righe lasciate vuote (tipico: l'Invio dopo l'ultimo nome) spariscono,
      // a meno che abbiano già acquisti agganciati.
      opponents: draft.opponents
        .filter((o) => o.name.trim() || takenByOwner[o.id])
        .map((o, i) => ({ id: o.id, name: o.name.trim() || `Squadra ${i + 1}` })),
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

        <div className="flex flex-col gap-2 border-t border-hair pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-caps text-ink">
              Avversari · {draft.opponents.length}
            </span>
            <button
              type="button"
              onClick={addOpponent}
              className="text-[11px] font-bold uppercase tracking-caps text-campo hover:text-ink"
            >
              + Aggiungi
            </button>
          </div>
          {draft.opponents.length === 0 ? (
            <p className="font-serif text-[13px] italic leading-relaxed text-muted">
              Le altre squadre della lega, con gli stessi crediti e gli stessi slot. Servono per sapere, su ogni
              calciatore in asta, chi può ancora rilanciare e fin dove.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {draft.opponents.map((o, i) => {
                const assigned = takenByOwner[o.id] || 0
                return (
                  <li key={o.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={o.name}
                      autoFocus={o.id === focusId}
                      placeholder="Nome squadra"
                      onChange={(e) => renameOpponent(o.id, e.target.value)}
                      onKeyDown={(e) => {
                        // Invio sull'ultima riga apre subito la successiva: sette
                        // nomi si scrivono senza mai toccare il mouse.
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (i === draft.opponents.length - 1) addOpponent()
                        }
                      }}
                      className={`${inputClasses} min-w-0 flex-1 font-sans text-[14px]`}
                      aria-label={`Nome squadra ${i + 1}`}
                    />
                    {assigned > 0 && (
                      <span className="shrink-0 font-mono text-[11px] text-muted" title="Acquisti registrati">
                        {assigned} acq.
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeOpponent(o.id)}
                      className="shrink-0 p-1 text-muted hover:text-granata"
                      title={assigned > 0 ? `Rimuovi (${assigned} acquisti restano senza squadra)` : 'Rimuovi'}
                      aria-label={`Rimuovi ${o.name || `squadra ${i + 1}`}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M3 3l8 8M11 3l-8 8"></path>
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
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
