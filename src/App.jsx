import { useState } from 'react'
import { useStore } from './store.js'
import Header from './components/layout/Header.jsx'
import MobileTabBar from './components/layout/MobileTabBar.jsx'
import BudgetPanel from './components/dashboard/BudgetPanel.jsx'
import RosterSlots from './components/dashboard/RosterSlots.jsx'
import RosterList from './components/dashboard/RosterList.jsx'
import PlayerFilters from './components/players/PlayerFilters.jsx'
import PlayerTable from './components/players/PlayerTable.jsx'
import SuggestionsPanel from './components/suggestions/SuggestionsPanel.jsx'
import LeagueConfigModal from './components/setup/LeagueConfigModal.jsx'
import UndoToast from './components/common/UndoToast.jsx'
import { CLASSIC_ROLES } from './lib/roles.js'
import { getMySquad, getSlotsFilledByRole, getCreditsRemaining } from './lib/engine.js'

const TABS = [
  { id: 'cerca', label: 'Cerca' },
  { id: 'suggerimenti', label: 'Suggerimenti' },
]

function useBudgetSummary() {
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const mySquad = getMySquad(draftByPlayerId)
  return {
    leagueConfig,
    creditsRemaining: getCreditsRemaining(leagueConfig, mySquad),
    filled: getSlotsFilledByRole(mySquad),
  }
}

function Dashboard() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <BudgetPanel />
      <RosterSlots />
      <RosterList />
    </div>
  )
}

function TabBar() {
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  return (
    <nav className="hidden gap-4 border-b border-slate-200 bg-white px-4 lg:flex">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
            activeTab === t.id
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const activeTab = useStore((s) => s.activeTab)
  const showLeagueConfigModal = useStore((s) => s.showLeagueConfigModal)
  const [mobileDashboardOpen, setMobileDashboardOpen] = useState(false)
  const { leagueConfig, creditsRemaining, filled } = useBudgetSummary()

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 lg:flex-row">
      <aside className="hidden w-[380px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white lg:flex">
        <Header />
        <Dashboard />
      </aside>

      <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
        <button
          className="flex w-full items-center justify-between gap-2"
          onClick={() => setMobileDashboardOpen((v) => !v)}
        >
          <span className="text-sm font-semibold text-emerald-700">⚽ Asta Fantacalcio</span>
          <span className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{creditsRemaining} cr</span>
            {CLASSIC_ROLES.map((r) => (
              <span key={r}>
                {r} {filled[r]}/{leagueConfig.roles[r]}
              </span>
            ))}
            <span aria-hidden>{mobileDashboardOpen ? '▲' : '▼'}</span>
          </span>
        </button>
        {mobileDashboardOpen && (
          <div className="border-t border-slate-100">
            <Header />
            <Dashboard />
          </div>
        )}
      </div>

      <main className="flex flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
        <TabBar />
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'cerca' ? (
            <div className="flex flex-col gap-3">
              <PlayerFilters />
              <PlayerTable />
            </div>
          ) : (
            <SuggestionsPanel />
          )}
        </div>
      </main>

      <MobileTabBar />
      {showLeagueConfigModal && <LeagueConfigModal />}
      <UndoToast />
    </div>
  )
}
