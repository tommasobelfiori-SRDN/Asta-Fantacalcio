import { formatAvg } from '../../lib/format.js'
import { hasReliableAverage } from '../../lib/engine.js'

// Rendimento dell'ultima stagione conclusa, il segnale che conta davvero all'asta
// (le prime giornate di campionato sono troppo poche per dire qualcosa).
// Colonna a destra nel listone da lg in su; su schermi stretti la riga usa
// `PrevSeasonInline`, che sta in coda ai dati mono.

// La fantamedia è il numero attorno a cui si contratta: sopra 7 è roba da big,
// sotto 6 è un rischio. Le soglie tingono solo il numero, senza pillole colorate.
function fmClass(fm) {
  if (fm == null) return 'text-ink'
  if (fm >= 7) return 'text-campo'
  if (fm < 6) return 'text-granata'
  return 'text-ink'
}

export function PrevSeasonInline({ stat }) {
  if (!stat) return null
  // Niente nowrap: su un telefono la riga è stretta e questo pezzo deve poter
  // andare a capo invece di finire sotto i bottoni.
  return (
    <span>
      {' '}· FM <span className={`font-semibold ${fmClass(stat.fantamedia)}`}>{formatAvg(stat.fantamedia)}</span>
      {stat.gol ? ` · ${stat.gol} gol` : ''}
    </span>
  )
}

export default function PrevSeasonStat({ stat, season }) {
  if (!stat) {
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
