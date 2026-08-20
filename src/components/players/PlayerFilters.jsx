import { useStore } from '../../store.js'
import { CLASSIC_ROLES, ROLE_LABELS } from '../../lib/roles.js'

export default function PlayerFilters() {
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <input
        type="text"
        value={filters.search}
        onChange={(e) => setFilters({ search: e.target.value })}
        placeholder="Cerca calciatore o squadra..."
        className="min-w-[180px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
      />
      <select
        value={filters.role}
        onChange={(e) => setFilters({ role: e.target.value })}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="fvm">Ordina per FVM</option>
        <option value="prezzo">Ordina per quotazione</option>
        <option value="nome">Ordina per nome</option>
      </select>
      <label className="flex items-center gap-1.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={filters.onlyAvailable}
          onChange={(e) => setFilters({ onlyAvailable: e.target.checked })}
          className="rounded border-slate-300"
        />
        Solo disponibili
      </label>
      <label className="flex items-center gap-1.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={filters.onlyPenaltyTakers}
          onChange={(e) => setFilters({ onlyPenaltyTakers: e.target.checked })}
          className="rounded border-slate-300"
        />
        Solo rigoristi
      </label>
    </div>
  )
}
