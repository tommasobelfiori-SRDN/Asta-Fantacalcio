import { useMemo, useState } from 'react'
import { useStore } from '../../store.js'
import { computeOpponentStates, getUnassignedTaken } from '../../lib/engine.js'
import { CLASSIC_ROLES, ROLE_FILL_CLASSES, ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import Badge from '../common/Badge.jsx'

// Il quadro delle altre squadre: crediti spesi e rimasti, slot riempiti, tetto
// sul prossimo acquisto, rosa. Da qui si correggono anche gli acquisti
// registrati di fretta senza squadra o senza prezzo.

const ROLE_ORDER = Object.fromEntries(CLASSIC_ROLES.map((r, i) => [r, i]))

function sortSquad(squad) {
  return squad
    .slice()
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || ROLE_ORDER[a.roleClassic] - ROLE_ORDER[b.roleClassic])
}

// Riga di un acquisto avversario, con squadra e prezzo modificabili sul posto:
// il menu salva al cambio, il prezzo su Invio o quando si esce dal campo.
function TakenRow({ entry, opponents, highlight = false }) {
  const updateTaken = useStore((s) => s.updateTaken)
  const freePlayer = useStore((s) => s.freePlayer)
  const [price, setPrice] = useState(entry.price ?? '')

  const savePrice = () => {
    if (String(price) !== String(entry.price ?? '')) updateTaken(entry.id, { price })
  }

  return (
    <li className="flex items-center gap-2.5 px-0.5 py-2 last:border-b-0 border-b border-hair">
      <Badge
        className={`h-[22px] w-[22px] text-xs ${highlight ? ROLE_BADGE_CLASSES[entry.roleClassic] : ROLE_FILL_CLASSES[entry.roleClassic]}`}
      >
        {entry.roleClassic}
      </Badge>
      <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-medium text-ink">
        {entry.name} <span className="font-mono text-[11px] font-normal text-muted">{entry.team}</span>
      </span>
      <select
        value={entry.ownerId && opponents.some((o) => o.id === entry.ownerId) ? entry.ownerId : ''}
        onChange={(e) => updateTaken(entry.id, { ownerId: e.target.value || null })}
        aria-label={`Squadra che ha preso ${entry.name}`}
        className={`h-8 w-24 rounded-[2px] border-[1.5px] bg-card px-1 text-[11px] font-semibold text-ink focus:border-campo focus:outline-none ${
          highlight ? 'border-ocra' : 'border-hair'
        }`}
      >
        <option value="">Chi?</option>
        {opponents.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={savePrice}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder="cr"
        aria-label={`Prezzo pagato per ${entry.name}`}
        className={`h-8 w-14 rounded-[2px] border-[1.5px] bg-card text-center font-mono text-[13px] font-semibold text-ink focus:border-campo focus:outline-none ${
          entry.price == null ? 'border-ocra' : 'border-hair'
        }`}
      />
      <button
        onClick={() => freePlayer(entry.id, entry.name)}
        className="p-1 text-muted hover:text-granata"
        title="Libera"
        aria-label={`Libera ${entry.name}`}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M3 3l8 8M11 3l-8 8"></path>
        </svg>
      </button>
    </li>
  )
}

function OpponentCard({ state, opponents, open, onToggle }) {
  const { name, squad, spent, remaining, filled, maxBudget, withoutPrice } = state
  const roles = useStore((s) => s.leagueConfig.roles)

  return (
    <li className="border-b border-hair">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-1 py-3 text-left hover:bg-ink/[0.03]"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-serif text-[22px] font-medium leading-none text-ink">{name}</span>
          <span className="flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] text-muted">
            {CLASSIC_ROLES.map((r) => (
              <span key={r} className={filled[r] >= (roles[r] || 0) ? 'font-semibold text-campo' : ''}>
                {r} {filled[r]}/{roles[r] || 0}
              </span>
            ))}
            <span>· spesi {spent}</span>
            {withoutPrice > 0 && <span className="text-ocra">· {withoutPrice} senza prezzo</span>}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={`font-mono text-[26px] font-semibold leading-none ${remaining < 0 ? 'text-granata' : 'text-ink'}`}>
            {remaining}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-caps text-muted">Crediti</span>
        </div>
        <div className="hidden w-[76px] shrink-0 flex-col items-end sm:flex">
          {maxBudget.complete ? (
            <span className="text-[10px] font-bold uppercase tracking-caps text-campo">Completa</span>
          ) : (
            <>
              <span className="font-mono text-[18px] font-semibold leading-none text-campo">{maxBudget.value}</span>
              <span className="text-[9px] font-bold uppercase tracking-caps text-muted">Tetto</span>
            </>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={`shrink-0 text-muted ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5l3 3 3-3"></path>
        </svg>
      </button>
      {open && (
        <div className="px-1 pb-3">
          {squad.length === 0 ? (
            <p className="py-2 font-serif text-[13px] italic text-muted">Nessun acquisto registrato.</p>
          ) : (
            <ul className="border-t border-ink">
              {sortSquad(squad).map((entry) => (
                <TakenRow key={entry.id} entry={entry} opponents={opponents} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

export default function OpponentsPanel() {
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const setShowLeagueConfigModal = useStore((s) => s.setShowLeagueConfigModal)
  const [openId, setOpenId] = useState(null)

  const opponents = leagueConfig.opponents
  const states = useMemo(
    () => computeOpponentStates(leagueConfig, draftByPlayerId).sort((a, b) => b.remaining - a.remaining),
    [leagueConfig, draftByPlayerId]
  )
  const unassigned = useMemo(() => getUnassignedTaken(draftByPlayerId, leagueConfig), [draftByPlayerId, leagueConfig])

  if (opponents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 border-y-2 border-ink px-6 py-10 text-center">
        <span className="font-serif text-lg italic text-muted">Nessun avversario ancora</span>
        <span className="max-w-md text-[13px] leading-relaxed text-muted">
          Aggiungi le altre squadre della lega e segna i loro acquisti col prezzo: su ogni calciatore in asta
          saprai chi può ancora rilanciare e quanto ti serve per anticiparlo.
        </span>
        <button
          onClick={() => setShowLeagueConfigModal(true)}
          className="mt-1 h-10 rounded-[2px] bg-ink px-5 text-[11px] font-bold uppercase tracking-caps text-paper shadow-press hover:opacity-90"
        >
          Aggiungi avversari
        </button>
      </div>
    )
  }

  const totalTaken = states.reduce((sum, s) => sum + s.squad.length, 0)

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
        <span className="text-[13px] font-extrabold uppercase tracking-caps text-ink">
          Avversari · {states.length}
        </span>
        <span className="flex items-center gap-4">
          <span className="hidden font-mono text-xs text-muted sm:inline">{totalTaken} acquisti registrati</span>
          <button
            onClick={() => setShowLeagueConfigModal(true)}
            className="text-[11px] font-bold uppercase tracking-caps text-muted hover:text-ink"
          >
            Gestisci
          </button>
        </span>
      </div>

      {unassigned.length > 0 && (
        <div className="flex flex-col border-l-[3px] border-l-ocra bg-ocra/[0.06] px-3 py-2">
          <div className="flex items-baseline justify-between pb-1">
            <span className="text-[11px] font-bold uppercase tracking-caps text-ocra">
              Senza squadra · {unassigned.length}
            </span>
            <span className="font-serif text-[12px] italic text-muted">
              Finché non li attribuisci, i crediti degli altri sono per eccesso.
            </span>
          </div>
          <ul>
            {sortSquad(unassigned).map((entry) => (
              <TakenRow key={entry.id} entry={entry} opponents={opponents} highlight />
            ))}
          </ul>
        </div>
      )}

      <ul>
        {states.map((state) => (
          <OpponentCard
            key={state.id}
            state={state}
            opponents={opponents}
            open={openId === state.id}
            onToggle={() => setOpenId(openId === state.id ? null : state.id)}
          />
        ))}
      </ul>
    </div>
  )
}
