import { useStore } from '../../store.js'
import { getMySquad } from '../../lib/engine.js'
import { ROLE_FILL_CLASSES } from '../../lib/roles.js'
import Badge from '../common/Badge.jsx'

export default function RosterList() {
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const freePlayer = useStore((s) => s.freePlayer)
  const mySquad = getMySquad(draftByPlayerId).sort((a, b) => (b.price || 0) - (a.price || 0))

  return (
    <div className="flex flex-col">
      <div className="border-b border-ink pb-1.5 text-[11px] font-bold uppercase tracking-caps text-ink">
        La tua rosa · {mySquad.length}
      </div>
      {mySquad.length === 0 ? (
        <p className="px-0.5 py-3 font-serif text-sm italic text-muted">Non hai ancora preso nessun calciatore.</p>
      ) : (
        <ul>
          {mySquad.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-2.5 px-0.5 py-2.5 ${i === mySquad.length - 1 ? '' : 'border-b border-hair'}`}
            >
              <Badge className={`h-[22px] w-[22px] text-xs ${ROLE_FILL_CLASSES[p.roleClassic]}`}>{p.roleClassic}</Badge>
              <span className="min-w-0 flex-1 truncate font-serif text-[17px] font-medium text-ink">
                {p.name} <span className="font-mono text-[11px] font-normal text-muted">{p.team}</span>
              </span>
              <span className="font-mono text-[15px] font-semibold">{p.price} cr</span>
              <button
                onClick={() => freePlayer(p.id, p.name)}
                className="p-1 text-muted hover:text-granata"
                title="Libera"
                aria-label={`Libera ${p.name}`}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M3 3l8 8M11 3l-8 8"></path>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
