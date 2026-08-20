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
    <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-emerald-700">⚽ Asta Fantacalcio</h1>
        <button
          onClick={() => setShowLeagueConfigModal(true)}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          title="Impostazioni lega"
          aria-label="Impostazioni lega"
        >
          ⚙️
        </button>
      </div>

      <DataRefreshBar />

      <div className="flex items-center justify-between gap-2 text-xs">
        <ExportImportState />
        <button onClick={() => setShowResetConfirm(true)} className="text-slate-400 hover:text-rose-600">
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
