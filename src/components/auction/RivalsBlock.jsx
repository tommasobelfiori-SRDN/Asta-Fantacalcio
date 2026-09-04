import { useMemo } from 'react'
import { useStore } from '../../store.js'
import { computeAnticipation } from '../../lib/engine.js'

// Chi può ancora rilanciare sul calciatore in asta, e fin dove. Il numero in
// alto risponde alla domanda che ci si fa quando il banditore conta: quanto
// devo mettere per essere sicuro? Un credito sopra il tetto del più ricco tra
// chi ha ancora uno slot libero in questo ruolo — se il tuo tetto lo permette.
//
// Due cifre per avversario: il tetto (quanto PUÒ spendere, riservando un
// credito per ogni altro slot da riempire) e la stima (quanto spenderebbe
// seguendo lo stesso criterio della tua offerta consigliata). A inizio asta
// i tetti sono tutti alti e conta la stima; verso la fine è il tetto a
// decidere chi è ancora in corsa.

const OUT_REASON = {
  'ruolo-completo': 'ruolo pieno',
  'senza-crediti': 'senza crediti',
}

function Headline({ tone, value, title, note }) {
  const tones = {
    campo: 'bg-campo text-paper',
    ink: 'bg-ink text-paper',
    ocra: 'bg-ocra text-paper',
    granata: 'bg-granata text-paper',
  }
  return (
    <div className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${tones[tone]}`}>
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-caps">{title}</span>
        {note && <span className="text-[11px] leading-snug opacity-90">{note}</span>}
      </div>
      {value != null && (
        <span className="shrink-0 font-mono text-[26px] font-semibold leading-none">{value}</span>
      )}
    </div>
  )
}

export default function RivalsBlock({ player }) {
  const players = useStore((s) => s.players)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const leagueConfig = useStore((s) => s.leagueConfig)
  const setShowLeagueConfigModal = useStore((s) => s.setShowLeagueConfigModal)
  const setActiveTab = useStore((s) => s.setActiveTab)

  const result = useMemo(
    () => computeAnticipation({ player, players, draftByPlayerId, leagueConfig }),
    [player, players, draftByPlayerId, leagueConfig]
  )

  if (leagueConfig.opponents.length === 0) {
    return (
      <div className="border-[1.5px] border-dashed border-muted px-3.5 py-3 text-[12px] leading-relaxed text-muted">
        Segna gli avversari nelle{' '}
        <button
          onClick={() => setShowLeagueConfigModal(true)}
          className="font-bold uppercase tracking-caps text-campo hover:text-ink"
        >
          impostazioni
        </button>{' '}
        e registra i loro acquisti: qui vedrai chi può ancora rilanciare e fin dove.
      </div>
    )
  }

  const { bid, threat, needed, feasible, covered, rivalMax } = result
  const { contenders, outOfRace, topThreat, unassigned } = threat
  const role = player.roleClassic

  let headline
  if (contenders.length === 0) {
    headline = (
      <Headline
        tone="campo"
        title="Nessuno può rilanciare"
        note="Ruolo pieno o crediti finiti per tutti gli avversari: parti dalla base."
      />
    )
  } else if (covered) {
    headline = (
      <Headline
        tone="campo"
        value={`${needed} cr`}
        title="Ti basta l'offerta consigliata"
        note={`${topThreat.name} è il più ricco in corsa e non può superare ${rivalMax}.`}
      />
    )
  } else if (feasible) {
    headline = (
      <Headline
        tone="ink"
        value={`${needed} cr`}
        title="Per anticiparli tutti"
        note={`${topThreat.name} può arrivare a ${rivalMax}: sono ${needed - (bid.value ?? 0)} cr sopra il consiglio.`}
      />
    )
  } else if (rivalMax === bid.maxBudget.value) {
    // Tipico a inizio asta, quando nessuno ha ancora speso: stesso tetto per
    // tutti, e non è una sconfitta ma una gara alla pari.
    headline = (
      <Headline
        tone="ocra"
        value={`${rivalMax} cr`}
        title={`Alla pari con ${topThreat.name}`}
        note={`Stesso tetto: nessuno dei due può anticipare l'altro, decide chi lo vuole di più.`}
      />
    )
  } else {
    headline = (
      <Headline
        tone="granata"
        value={`${rivalMax} cr`}
        title={`Non puoi anticipare ${topThreat.name}`}
        note={`Può arrivare a ${rivalMax}, il tuo tetto è ${bid.maxBudget.value}. Se lo vuole davvero, lo prende.`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {headline}

      {contenders.length > 0 && (
        <ul>
          <li className="flex items-baseline gap-2 border-b border-ink pb-1 text-[9px] font-bold uppercase tracking-caps text-muted">
            <span className="flex-1">In corsa · {contenders.length}</span>
            <span className="w-11 text-right">Tetto</span>
            <span className="w-11 text-right">Stima</span>
          </li>
          {contenders.map((c) => (
            <li key={c.id} className="flex items-baseline gap-2 border-b border-hair py-1.5 last:border-b-0">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-semibold text-ink">{c.name}</span>
                <span className="font-mono text-[10px] text-muted">
                  {c.remaining} cr · {c.remainingByRole[role]} {role} liber{c.remainingByRole[role] === 1 ? 'o' : 'i'}
                  {c.withoutPrice > 0 && <span className="text-ocra"> · {c.withoutPrice} senza prezzo</span>}
                </span>
              </span>
              <span
                className={`w-11 text-right font-mono text-[14px] font-semibold ${
                  c.maxBid >= (bid.maxBudget.value || 0) ? 'text-granata' : 'text-ink'
                }`}
              >
                {c.maxBid}
              </span>
              <span className="w-11 text-right font-mono text-[12px] text-muted">
                {c.estimate != null ? `~${c.estimate}` : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {outOfRace.length > 0 && (
        <p className="font-serif text-[12px] italic leading-relaxed text-muted">
          Fuori: {outOfRace.map((o) => `${o.name} (${OUT_REASON[o.why]})`).join(' · ')}
        </p>
      )}

      {unassigned.length > 0 && (
        <p className="border-l-[3px] border-l-ocra bg-ocra/[0.08] px-3 py-2 text-[11px] leading-snug text-ink">
          {unassigned.length} acquist{unassigned.length === 1 ? 'o' : 'i'} senza squadra: i tetti sono per eccesso.{' '}
          <button
            onClick={() => setActiveTab('avversari')}
            className="font-bold uppercase tracking-caps text-ocra hover:text-ink"
          >
            Attribuisci
          </button>
        </p>
      )}
    </div>
  )
}
