import { useEffect, useState } from 'react'
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
import { CLASSIC_ROLES, ROLE_BADGE_CLASSES } from './lib/roles.js'
import { getMySquad, getSlotsFilledByRole, getCreditsRemaining, getAvailablePlayers } from './lib/engine.js'

const TABS = [
  { id: 'cerca', label: 'Cerca' },
  { id: 'suggerimenti', label: 'Suggerimenti' },
]

const ROLE_TEXT_CLASSES = {
  P: 'text-ocra',
  D: 'text-azzurro',
  C: 'text-campo',
  A: 'text-granata',
}

function Dashboard() {
  return (
    <div className="flex flex-col gap-5 px-6 pb-6">
      <BudgetPanel />
      <RosterSlots />
      <RosterList />
    </div>
  )
}

function TabBar() {
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const players = useStore((s) => s.players)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const available = getAvailablePlayers(players, draftByPlayerId).length

  return (
    <nav className="hidden items-end justify-between border-b-2 border-ink bg-paper px-9 lg:flex">
      <div className="flex gap-7">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`-mb-[2px] pb-2.5 text-[13px] uppercase tracking-caps ${
              activeTab === t.id
                ? 'border-b-4 border-ink font-extrabold text-ink'
                : 'border-b-4 border-transparent font-semibold text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {players.length > 0 && (
        <span className="pb-2.5 font-mono text-xs text-muted">
          {available} disponibili su {players.length}
        </span>
      )}
    </nav>
  )
}

export default function App() {
  const activeTab = useStore((s) => s.activeTab)
  const showLeagueConfigModal = useStore((s) => s.showLeagueConfigModal)
  const theme = useStore((s) => s.theme)
  const [mobileDashboardOpen, setMobileDashboardOpen] = useState(false)

  // Tema: scelta esplicita se salvata, altrimenti segue il sistema (anche live).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme ? theme === 'dark' : mq.matches
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  const leagueConfig = useStore((s) => s.leagueConfig)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const mySquad = getMySquad(draftByPlayerId)
  const creditsRemaining = getCreditsRemaining(leagueConfig, mySquad)
  const filled = getSlotsFilledByRole(mySquad)

  return (
    <div className="flex h-screen flex-col bg-paper text-ink lg:flex-row">
      <aside className="hidden w-[380px] shrink-0 flex-col overflow-y-auto border-r-2 border-ink bg-paper lg:flex">
        <Header />
        <Dashboard />
      </aside>

      <div className="border-b-2 border-ink bg-paper px-4 py-2.5 lg:hidden">
        <button
          className="flex w-full items-center justify-between gap-2"
          onClick={() => setMobileDashboardOpen((v) => !v)}
        >
          <span className="font-serif text-lg font-extrabold italic text-ink">Asta Fantacalcio</span>
          <span className="flex items-center gap-2.5 font-mono text-xs text-muted">
            <span className="text-[15px] font-semibold text-ink">{creditsRemaining} cr</span>
            {CLASSIC_ROLES.map((r) => (
              <span key={r} className={filled[r] > 0 ? `font-semibold ${ROLE_TEXT_CLASSES[r]}` : ''}>
                {r} {filled[r]}/{leagueConfig.roles[r]}
              </span>
            ))}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className={mobileDashboardOpen ? 'rotate-180' : ''}
            >
              <path d="M2 3.5l3 3 3-3"></path>
            </svg>
          </span>
        </button>
        {mobileDashboardOpen && (
          <div className="border-t border-hair">
            <Header />
            <Dashboard />
          </div>
        )}
      </div>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
        <TabBar />
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-9 lg:py-4">
          {activeTab === 'cerca' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <PlayerFilters />
              <PlayerTable />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SuggestionsPanel />
            </div>
          )}
        </div>
      </main>

      <MobileTabBar />
      {showLeagueConfigModal && <LeagueConfigModal />}
      <UndoToast />
    </div>
  )
}
