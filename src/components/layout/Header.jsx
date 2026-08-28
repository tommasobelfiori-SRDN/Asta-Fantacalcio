import { useState } from 'react'
import { useStore } from '../../store.js'
import DataRefreshBar from '../setup/DataRefreshBar.jsx'
import ExportImportState from '../common/ExportImportState.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'

function ThemeToggle() {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const isDark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-1 text-muted hover:text-ink"
      title={isDark ? 'Modalità chiara' : 'Modalità scura'}
      aria-label={isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"></path>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>
        </svg>
      )}
    </button>
  )
}

export default function Header() {
  const setShowLeagueConfigModal = useStore((s) => s.setShowLeagueConfigModal)
  const resetDraft = useStore((s) => s.resetDraft)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  return (
    <div className="flex flex-col gap-4 p-6 pb-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-caps text-muted">
            Stagione 2026/27 · Serie A
          </span>
          <span className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setShowLeagueConfigModal(true)}
              className="p-1 text-muted hover:text-ink"
              title="Impostazioni lega"
              aria-label="Impostazioni lega"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </span>
        </div>
        <h1 className="font-serif text-[32px] font-extrabold italic leading-none text-ink">Asta Fantacalcio</h1>
        <div className="mt-2 h-[5px] border-b border-t-2 border-ink"></div>
      </div>

      <DataRefreshBar />

      <div className="flex items-center justify-between gap-2 border-t border-hair pt-3 text-[11px] font-semibold">
        <ExportImportState />
        <button
          onClick={() => setShowResetConfirm(true)}
          className="uppercase tracking-caps text-muted hover:text-granata"
        >
          Azzera asta
        </button>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          title="Azzerare l'asta?"
          message="Tutti i giocatori marcati (tuoi e degli avversari) verranno liberati. La configurazione della lega resta invariata."
          confirmLabel="Azzera"
          onConfirm={() => {
            resetDraft()
            setShowResetConfirm(false)
          }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  )
}
