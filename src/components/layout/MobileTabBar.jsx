import { useStore } from '../../store.js'

const TABS = [
  { id: 'cerca', label: 'Cerca', icon: '🔍' },
  { id: 'suggerimenti', label: 'Suggerimenti', icon: '💡' },
]

export default function MobileTabBar() {
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white lg:hidden">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
            activeTab === t.id ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <span className="text-base">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
