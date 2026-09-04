import { useStore } from '../../store.js'

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5"></circle>
      <path d="M10.5 10.5L14 14"></path>
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 10.9 4.3 13l.8-4.2L2 5.9l4.2-.5z"></path>
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5"></circle>
      <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"></path>
      <path d="M11 3.2a2.5 2.5 0 0 1 0 3.6M12.5 9.7c1.3.5 2 1.7 2 3.8"></path>
    </svg>
  )
}

const TABS = [
  { id: 'cerca', label: 'Cerca', Icon: SearchIcon },
  { id: 'suggerimenti', label: 'Suggerimenti', Icon: StarIcon },
  { id: 'avversari', label: 'Avversari', Icon: UsersIcon },
]

export default function MobileTabBar() {
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-ink bg-card lg:hidden">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`-mt-[2px] flex flex-1 flex-col items-center gap-1 pb-3.5 pt-2.5 text-[10px] uppercase tracking-caps ${
            activeTab === id
              ? 'border-t-[3px] border-ink font-extrabold text-ink'
              : 'border-t-[3px] border-transparent font-bold text-muted'
          }`}
        >
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  )
}
