import { useState } from 'react'
import { useStore } from '../../store.js'
import Modal from '../common/Modal.jsx'

const STATUS_LABELS = {
  titolare: 'Titolare',
  entrato: 'Entrato a gara in corso',
  infortunato: 'Infortunato',
  squalificato: 'Squalificato',
  inutilizzato: 'Inutilizzato',
}

function StatusRow({ label, value }) {
  if (!value) return null
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-800">
        {value.percent != null ? `${value.percent}%` : value.raw || '—'}
      </span>
    </li>
  )
}

export default function PlayerDetailsButton({ player }) {
  const [open, setOpen] = useState(false)
  const detail = useStore((s) => s.playerDetailsById[player.id])
  const fetchPlayerDetails = useStore((s) => s.fetchPlayerDetails)

  if (!player.profileUrl) return null

  const handleOpen = () => {
    setOpen(true)
    fetchPlayerDetails(player)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="shrink-0 rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100"
        title="Dettagli calciatore"
        aria-label={`Dettagli su ${player.name}`}
      >
        ℹ️
      </button>
      {open && (
        <Modal title={player.name} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 text-sm">
            {(!detail || detail.status === 'loading') && <p className="text-slate-500">Caricamento…</p>}

            {detail?.status === 'error' && <p className="text-rose-600">{detail.error}</p>}

            {detail?.status === 'ready' && (
              <>
                <div className="flex gap-6">
                  <div>
                    <div className="text-xs text-slate-400">Media voto</div>
                    <div className="text-lg font-semibold text-slate-900">{detail.data.mediaVoto ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Fantamedia</div>
                    <div className="text-lg font-semibold text-slate-900">{detail.data.fantamedia ?? '—'}</div>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Stagione in corso
                  </div>
                  <ul className="flex flex-col gap-1">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <StatusRow key={key} label={label} value={detail.data.seasonStatus?.[key]} />
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Cronaca infortuni (Transfermarkt)
                  </div>
                  {detail.data.transfermarkt?.found && detail.data.transfermarkt.injuries.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {detail.data.transfermarkt.injuries.map((inj, i) => (
                        <li key={i} className="rounded border border-slate-100 px-2 py-1.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-medium text-slate-800">{inj.tipo}</span>
                            <span className="shrink-0 text-xs text-slate-400">{inj.stagione}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {inj.da} → {inj.a} · {inj.giorni}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {detail.data.transfermarkt?.found && detail.data.transfermarkt.injuries.length === 0 && (
                    <p className="text-xs text-slate-500">Nessun infortunio registrato su Transfermarkt.</p>
                  )}
                  {detail.data.transfermarkt && !detail.data.transfermarkt.found && (
                    <p className="text-xs text-slate-400">
                      Calciatore non trovato con certezza su Transfermarkt (nome o squadra non corrispondenti).
                    </p>
                  )}
                  {detail.data.transfermarkt?.found && (
                    <a
                      href={`https://www.transfermarkt.it/x/verletzungen/spieler/${detail.data.transfermarkt.tmId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Storico completo su Transfermarkt ↗
                    </a>
                  )}
                </div>

                {detail.data.description && <p className="text-xs leading-relaxed text-slate-500">{detail.data.description}</p>}
              </>
            )}

            <p className="text-xs text-slate-400">
              Statistiche delle stagioni passate non disponibili come dato strutturato su fantacalcio.it (solo
              grafici) — per quelle serve la scheda completa.
            </p>

            <a
              href={player.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Apri scheda completa su fantacalcio.it ↗
            </a>
          </div>
        </Modal>
      )}
    </>
  )
}
