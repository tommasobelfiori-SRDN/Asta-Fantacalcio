import { formatAvg, formatCompetition } from '../../lib/format.js'
import { hasReliableAverage } from '../../lib/engine.js'

// Rendimento dell'ultima stagione conclusa, il segnale che conta davvero all'asta
// (le prime giornate di campionato sono troppo poche per dire qualcosa).
// Colonna a destra nel listone da lg in su; su schermi stretti la riga usa
// `PrevSeasonInline`, che sta in coda ai dati mono.
//
// Chi la stagione scorsa non era in Serie A non ha fantamedia: al suo posto si
// mostra dove giocava e quanto (`prevSeasonAbroad`). Sono due misure diverse e
// non vanno confuse, quindi la colonna cambia forma invece di fingere un voto.

// La fantamedia è il numero attorno a cui si contratta: sopra 7 è roba da big,
// sotto 6 è un rischio. Le soglie tingono solo il numero, senza pillole colorate.
function fmClass(fm) {
  if (fm == null) return 'text-ink'
  if (fm >= 7) return 'text-campo'
  if (fm < 6) return 'text-granata'
  return 'text-ink'
}

// Gol per i giocatori di movimento, presenze per i portieri: è il numero che si
// guarda per primo quando il nome non dice nulla.
function abroadHighlight(stat, role) {
  if (role === 'P' || !stat.gol) return null
  return `${stat.gol} gol`
}

export function PrevSeasonInline({ stat, abroad, role }) {
  if (stat) {
    return (
      <span>
        {' '}· FM <span className={`font-semibold ${fmClass(stat.fantamedia)}`}>{formatAvg(stat.fantamedia)}</span>
        {stat.gol ? ` · ${stat.gol} gol` : ''}
      </span>
    )
  }
  if (!abroad) return null
  if (abroad.coppa) return <span> · {abroad.presenze} pres solo in coppa</span>
  const highlight = abroadHighlight(abroad, role)
  return (
    <span>
      {' '}· {formatCompetition(abroad.competition)} {abroad.presenze} pres
      {highlight ? ` · ${highlight}` : ''}
    </span>
  )
}

function AbroadColumn({ abroad, role }) {
  // Qualche presenza in coppa non è una stagione: dirlo evita di leggere "3"
  // come se fosse un campionato giocato.
  const label = abroad.coppa ? 'solo coppa' : formatCompetition(abroad.competition)
  return (
    <div
      className="hidden w-[104px] shrink-0 flex-col items-end lg:flex"
      title={`${abroad.presenze} presenze · ${abroad.club}, ${abroad.competition} ${abroad.season}`}
    >
      <span className="font-mono text-[15px] font-semibold leading-none text-ink">
        {abroad.presenze}
        <span className="ml-1 text-[10px] font-normal text-muted">pres</span>
      </span>
      <span className={`mt-0.5 truncate font-mono text-[10px] ${abroad.primaDivisione ? 'text-azzurro' : 'text-muted'}`}>
        {label}
        {abroadHighlight(abroad, role) ? ` · ${abroad.gol}g` : ''}
      </span>
    </div>
  )
}

export default function PrevSeasonStat({ stat, abroad, season, role }) {
  if (!stat) {
    if (abroad) return <AbroadColumn abroad={abroad} role={role} />
    return (
      <div className="hidden w-[104px] shrink-0 flex-col items-end lg:flex">
        <span className="font-serif text-[13px] italic text-muted">esordiente</span>
      </div>
    )
  }
  // Poche presenze: media mostrata attenuata, così si vede a colpo d'occhio che
  // il numero poggia su un campione troppo piccolo per fidarsi.
  const reliable = hasReliableAverage(stat)
  return (
    <div
      className="hidden w-[104px] shrink-0 flex-col items-end lg:flex"
      title={reliable ? `Stagione ${season}` : `Stagione ${season} · solo ${stat.presenze} presenze, media poco indicativa`}
    >
      <span
        className={`font-mono text-[15px] font-semibold leading-none ${
          reliable ? fmClass(stat.fantamedia) : 'text-muted'
        }`}
      >
        {formatAvg(stat.fantamedia)}
        {!reliable && <span className="text-[10px]">*</span>}
      </span>
      <span className="mt-0.5 font-mono text-[10px] text-muted">
        {stat.presenze} pres{stat.gol ? ` · ${stat.gol} gol` : ''}
      </span>
    </div>
  )
}
