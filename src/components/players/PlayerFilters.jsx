import { useStore } from '../../store.js'
import { CLASSIC_ROLES, ROLE_LABELS } from '../../lib/roles.js'

export default function PlayerFilters() {
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-1">
      <div className="flex min-w-[200px] max-w-xs flex-1 items-center gap-2 border-b-[1.5px] border-ink pb-1.5">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-ink">
          <circle cx="7" cy="7" r="4.5"></circle>
          <path d="M10.5 10.5L14 14"></path>
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Cerca calciatore o squadra…"
          className="w-full bg-transparent font-serif text-[15px] italic text-ink placeholder:text-muted focus:outline-none"
        />
      </div>
      <select
        value={filters.role}
        onChange={(e) => setFilters({ role: e.target.value })}
        className="cursor-pointer bg-transparent text-xs font-bold uppercase tracking-caps text-ink focus:outline-none"
      >
        <option value="all">Tutti i ruoli</option>
        {CLASSIC_ROLES.map((r) => (
          <option key={r} value={r}>
            {r} — {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <select
        value={filters.sortBy}
        onChange={(e) => setFilters({ sortBy: e.target.value })}
        className="cursor-pointer bg-transparent text-xs font-bold uppercase tracking-caps text-ink focus:outline-none"
      >
        <option value="fvm">Ordina · FVM</option>
        <option value="prezzo">Ordina · Quotazione</option>
        <option value="nome">Ordina · Nome</option>
      </select>
      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={filters.onlyAvailable}
          onChange={(e) => setFilters({ onlyAvailable: e.target.checked })}
          className="h-3.5 w-3.5 accent-ink"
        />
        Solo disponibili
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={filters.onlyPenaltyTakers}
          onChange={(e) => setFilters({ onlyPenaltyTakers: e.target.checked })}
          className="h-3.5 w-3.5 accent-ink"
        />
        Solo rigoristi
      </label>
    </div>
  )
}
