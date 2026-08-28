import { useState } from 'react'
import { useStore } from '../../store.js'
import DataRefreshBar from '../setup/DataRefreshBar.jsx'
import ExportImportState from '../common/ExportImportState.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'

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
          <button
            onClick={() => setShowLeagueConfigModal(true)}
            className="p-1 text-muted hover:text-ink"
            title="Impostazioni lega"
            aria-label="Impostazioni lega"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2.6"></circle>
              <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"></path>
            </svg>
          </button>
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
