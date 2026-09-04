import { useRef, useState } from 'react'
import { useStore } from '../../store.js'

// Registra un acquisto avversario: a chi e a quanto. Sono le due cose che il
// banditore ha appena chiuso, da segnare in un gesto prima che chiami il nome
// dopo. Squadra e prezzo restano facoltativi: meglio un "preso" incompleto
// (si corregge dopo, nella scheda Avversari) che un calciatore ancora in lista.
//
// layout 'inline' sta in una riga del listone (menu a tendina), 'panel' nel
// banco d'asta (una fila di bottoni, un tocco per squadra).
export default function TakenForm({ player, layout = 'inline', onDone, onCancel }) {
  const opponents = useStore((s) => s.leagueConfig.opponents)
  const markTaken = useStore((s) => s.markTaken)
  const setShowLeagueConfigModal = useStore((s) => s.setShowLeagueConfigModal)
  const [ownerId, setOwnerId] = useState('')
  const [price, setPrice] = useState('')
  const priceRef = useRef(null)

  const submit = (e) => {
    e.preventDefault()
    markTaken(player, { ownerId: ownerId || null, price })
    onDone?.()
  }
  const onKeyDown = (e) => {
    if (e.key === 'Escape') onCancel?.()
  }
  const ownerName = opponents.find((o) => o.id === ownerId)?.name

  if (layout === 'panel') {
    return (
      <form onSubmit={submit} className="flex flex-col gap-2.5 border-t-2 border-ink pt-3">
        <div className="text-[11px] font-bold uppercase tracking-caps text-muted">Preso da chi?</div>
        {opponents.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {opponents.map((o) => {
              const active = o.id === ownerId
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setOwnerId(active ? '' : o.id)
                    priceRef.current?.focus()
                  }}
                  className={`h-8 rounded-[2px] border-[1.5px] border-ink px-2.5 text-[11px] font-bold uppercase tracking-caps ${
                    active ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'
                  }`}
                >
                  {o.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="font-serif text-[13px] italic leading-relaxed text-muted">
            Aggiungi gli avversari nelle{' '}
            <button
              type="button"
              onClick={() => setShowLeagueConfigModal(true)}
              className="font-sans text-[11px] font-bold uppercase not-italic tracking-caps text-campo hover:text-ink"
            >
              impostazioni
            </button>{' '}
            per sapere chi può ancora rilanciare.
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <input
            ref={priceRef}
            type="number"
            min="0"
            inputMode="numeric"
            autoFocus
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={onKeyDown}
            placeholder="cr"
            aria-label="Prezzo pagato dall'avversario"
            className="w-24 rounded-[2px] border-[1.5px] border-ink bg-transparent px-3 py-2.5 text-center font-mono text-[17px] focus:border-campo focus:outline-none"
          />
          <button
            type="submit"
            className="h-12 min-w-0 flex-1 truncate rounded-[2px] bg-ink px-3 text-[11px] font-bold uppercase tracking-caps text-paper shadow-press hover:opacity-90"
          >
            {ownerName ? `A ${ownerName}` : 'A un altro'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-[2px] border-[1.5px] border-muted px-3 text-[11px] font-bold uppercase tracking-caps text-muted hover:border-ink hover:text-ink"
          >
            Esc
          </button>
        </div>
      </form>
    )
  }

  // Due righe strette (squadra + prezzo sopra, conferma sotto) invece di una
  // lunga: la riga del listone non ha spazio per quattro controlli affiancati
  // senza schiacciare il nome del calciatore.
  return (
    <form onSubmit={submit} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {opponents.length > 0 && (
          <select
            autoFocus
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Chi l'ha preso"
            className="h-11 w-24 rounded-[2px] border-[1.5px] border-ink bg-card px-1.5 text-[12px] font-semibold text-ink focus:border-campo focus:outline-none lg:h-8"
          >
            <option value="">Chi?</option>
            {opponents.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <input
          ref={priceRef}
          type="number"
          min="0"
          inputMode="numeric"
          autoFocus={opponents.length === 0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={onKeyDown}
          placeholder="cr"
          aria-label="Prezzo pagato dall'avversario"
          className="h-11 w-14 rounded-[2px] border-[1.5px] border-ink bg-card text-center font-mono text-[15px] font-semibold text-ink focus:border-campo focus:outline-none lg:h-8"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          className="h-11 flex-1 rounded-[2px] bg-ink px-3 text-[11px] font-bold uppercase tracking-caps text-paper hover:opacity-90 lg:h-8"
        >
          OK
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-[2px] border-[1.5px] border-muted px-3 text-[11px] font-bold uppercase tracking-caps text-muted hover:border-ink hover:text-ink lg:h-8"
        >
          Esc
        </button>
      </div>
    </form>
  )
}
