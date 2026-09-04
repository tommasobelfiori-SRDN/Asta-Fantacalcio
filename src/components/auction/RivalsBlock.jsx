import { useMemo } from 'react'
import { useStore } from '../../store.js'
import { computeAnticipation } from '../../lib/engine.js'

// Chi può ancora rilanciare sul calciatore in asta, e fin dove. La domanda che
// ci si fa quando il banditore conta è "quanto devo mettere per essere sicuro?",
// e la risposta non è una sola: dipende da chi resta in corsa. Per questo gli
// avversari sono divisi in due liste — quelli che puoi togliere di mezzo, con
// la cifra esatta che serve, e quelli che possono seguirti oltre il tuo tetto.
//
// Due numeri per avversario: il TETTO (quanto può spendere, riservando un
// credito per ogni altro slot da riempire) e la STIMA (quanto spenderebbe
// seguendo lo stesso criterio della tua offerta consigliata). A inizio asta i
// tetti sono tutti alti e conta la stima; verso la fine è il tetto a decidere.

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

function RivalRow({ rival, role, beatable }) {
  const slots = rival.remainingByRole[role]
  return (
    <li className="flex items-baseline gap-2 border-b border-hair py-1.5 last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink">{rival.name}</span>
        <span className="font-mono text-[10px] text-muted">
          {rival.remaining} cr · {slots} {role} liber{slots === 1 ? 'o' : 'i'}
          {rival.withoutPrice > 0 && <span className="text-ocra"> · {rival.withoutPrice} senza prezzo</span>}
        </span>
      </span>
      <span className={`w-11 text-right font-mono text-[14px] font-semibold ${beatable ? 'text-ink' : 'text-granata'}`}>
        {rival.maxBid}
      </span>
      <span className="w-11 text-right font-mono text-[12px] text-muted">
        {rival.estimate != null ? `~${rival.estimate}` : '—'}
      </span>
      {/* Per chi è battibile la cifra che chiude il discorso; per gli altri il
          posto resta vuoto, perché non esiste una cifra che basti. */}
      <span className={`w-11 text-right font-mono text-[13px] ${beatable ? 'font-semibold text-campo' : 'text-muted'}`}>
        {beatable ? rival.needed : '—'}
      </span>
    </li>
  )
}

function RivalGroup({ title, rivals, role, beatable, note }) {
  if (!rivals.length) return null
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2 border-b border-ink pb-1">
        <span
          className={`flex-1 text-[9px] font-bold uppercase tracking-caps ${beatable ? 'text-campo' : 'text-granata'}`}
        >
          {title} · {rivals.length}
        </span>
        <span className="w-11 text-right text-[9px] font-bold uppercase tracking-caps text-muted">Tetto</span>
        <span className="w-11 text-right text-[9px] font-bold uppercase tracking-caps text-muted">Stima</span>
        <span className="w-11 text-right text-[9px] font-bold uppercase tracking-caps text-muted">Servono</span>
      </div>
      <ul>
        {rivals.map((r) => (
          <RivalRow key={r.id} rival={r} role={role} beatable={beatable} />
        ))}
      </ul>
      {note && <p className="pt-1 font-serif text-[11px] italic leading-snug text-muted">{note}</p>}
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

  const { bid, threat, superabili, fuoriPortata, covered, rivalMax } = result
  const { outOfRace, unassigned } = threat
  const role = player.roleClassic
  const inCorsa = superabili.length + fuoriPortata.length
  // Fra i battibili basta superare il più ricco: gli altri hanno il tetto sotto.
  const perTutti = superabili.length ? Math.max(...superabili.map((c) => c.needed)) : 0

  let headline
  if (inCorsa === 0) {
    headline = (
      <Headline
        tone="campo"
        title="Nessuno può rilanciare"
        note="Ruolo pieno o crediti finiti per tutti gli avversari: parti dalla base."
      />
    )
  } else if (fuoriPortata.length === 0 && covered) {
    headline = (
      <Headline
        tone="campo"
        value={`${perTutti} cr`}
        title={`Li anticipi tutti e ${inCorsa}`}
        note="L'offerta consigliata è già sopra il tetto di ognuno di loro."
      />
    )
  } else if (fuoriPortata.length === 0) {
    headline = (
      <Headline
        tone="ink"
        value={`${perTutti} cr`}
        title={`Per anticiparli tutti e ${inCorsa}`}
        note={`Sono ${perTutti - (bid.value ?? 0)} cr sopra l'offerta consigliata.`}
      />
    )
  } else if (superabili.length === 0) {
    headline = (
      <Headline
        tone="granata"
        value={`${rivalMax} cr`}
        title={`Nessuno dei ${inCorsa} è alla tua portata`}
        note={`Il tuo tetto è ${bid.maxBudget.value}: se lo vogliono davvero, te lo portano via.`}
      />
    )
  } else {
    // "Oltre il tuo tetto" sarebbe impreciso a parità di crediti: chi ha il tuo
    // stesso tetto non ti supera, ma nemmeno lo anticipi. Si dicono le cifre.
    const nomi = fuoriPortata.map((c) => c.name)
    headline = (
      <Headline
        tone="ocra"
        value={`${superabili.length}/${inCorsa}`}
        title="Puoi anticiparne solo una parte"
        note={`${perTutti} cr per togliere di mezzo i battibili. ${nomi.join(', ')} ${
          nomi.length === 1 ? 'arriva' : 'arrivano'
        } fino a ${fuoriPortata[0].maxBid}, il tuo tetto è ${bid.maxBudget.value}.`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {headline}

      <RivalGroup title="Puoi anticiparli" rivals={superabili} role={role} beatable />
      <RivalGroup
        title="Non puoi anticiparli"
        rivals={fuoriPortata}
        role={role}
        beatable={false}
        note="Nessuna cifra alla tua portata li esclude: al massimo arrivi al loro stesso tetto. Puoi solo sperare che si fermino prima."
      />

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
