import { useStore } from '../../store.js'
import { getMySquad } from '../../lib/engine.js'
import { ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import Badge from '../common/Badge.jsx'

export default function RosterList() {
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const freePlayer = useStore((s) => s.freePlayer)
  const mySquad = getMySquad(draftByPlayerId).sort((a, b) => (b.price || 0) - (a.price || 0))

  if (mySquad.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
        Non hai ancora preso nessun calciatore.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        La tua rosa ({mySquad.length})
      </div>
      <ul className="divide-y divide-slate-100">
        {mySquad.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <Badge className={ROLE_BADGE_CLASSES[p.roleClassic]}>{p.roleClassic}</Badge>
              <span className="min-w-0 truncate font-medium text-slate-800">{p.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{p.team}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-semibold text-slate-900">{p.price} cr</span>
              <button
                onClick={() => freePlayer(p.id, p.name)}
                className="text-xs text-slate-400 hover:text-rose-600"
                title="Libera"
                aria-label={`Libera ${p.name}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
