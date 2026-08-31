import { useState } from 'react'
import { useStore } from '../../store.js'
import { ROLE_LABELS } from '../../lib/roles.js'
import { formatAvg } from '../../lib/format.js'
import Modal from '../common/Modal.jsx'
import { STATUS_MARKS } from '../common/Badge.jsx'

// Le voci cambiano senso col ruolo: per un portiere contano gol subiti e rigori
// parati, per tutti gli altri gol e assist.
function prevSeasonEntries(stat, role) {
  const base = [
    ['Presenze', stat.presenze],
    ['Media voto', formatAvg(stat.mediaVoto)],
  ]
  const specific =
    role === 'P'
      ? [
          ['Gol subiti', stat.golSubiti],
          ['Rigori parati', stat.rigoriParati],
        ]
      : [
          ['Gol', stat.gol],
          ['Assist', stat.assist],
        ]
  const rigori =
    stat.rigoriCalciati > 0 ? [['Rigori', `${stat.rigoriSegnati}/${stat.rigoriCalciati}`]] : []
  const cartellini = [['Ammonizioni', stat.ammonizioni], ['Espulsioni', stat.espulsioni]]
  return [...base, ...specific, ...rigori, ...cartellini].filter(([, v]) => v != null && v !== '—')
}

const STATUS_LABELS = {
  titolare: 'Titolare',
  entrato: 'Entrato a gara in corso',
  infortunato: 'Infortunato',
  squalificato: 'Squalificato',
  inutilizzato: 'Inutilizzato',
}

function StatusRow({ label, value }) {
  if (!value) return null
  const percent = value.percent
  return (
    <li className="flex items-center gap-3 border-b border-hair py-2 last:border-b-0">
      <span className="w-44 shrink-0 text-[13px]">{label}</span>
      <span className="h-2 flex-1 bg-ink/10">
        {percent != null && percent > 0 && (
          <span className="block h-2 bg-campo" style={{ width: `${Math.min(100, percent)}%` }}></span>
        )}
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-[13px] text-muted">
        {percent != null ? `${value.count ?? '—'} · ${percent}%` : value.raw || '—'}
      </span>
    </li>
  )
}

function parseDays(giorni) {
  const n = Number(String(giorni || '').match(/\d+/)?.[0])
  return Number.isFinite(n) ? n : null
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

  const tm = detail?.data?.transfermarkt
  const prev = player.prevSeason

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-[2px] border-[1.5px] border-muted/60 text-muted hover:border-ink hover:text-ink lg:h-8 lg:w-8"
        title="Dettagli calciatore"
        aria-label={`Dettagli su ${player.name}`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6.5"></circle>
          <path d="M8 7.2v4"></path>
          <circle cx="8" cy="4.8" r="0.4" fill="currentColor"></circle>
        </svg>
      </button>
      {open && (
        <Modal
          title={player.name}
          subtitle={`${player.team} · ${ROLE_LABELS[player.roleClassic]} · ${player.quotazioneClassicAttuale} cr · FVM ${player.fvmClassic}`}
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-col gap-5 text-sm">
            {player.status && (
              <div
                className={`border-l-[3px] px-3 py-2.5 ${
                  player.status.tipo === 'diffidato'
                    ? 'border-l-ocra bg-ocra/[0.08]'
                    : 'border-l-granata bg-granata/[0.08]'
                }`}
              >
                <div
                  className={`text-[11px] font-bold uppercase tracking-caps ${
                    player.status.tipo === 'diffidato' ? 'text-ocra' : 'text-granata'
                  }`}
                >
                  {STATUS_MARKS[player.status.tipo]?.label ?? player.status.tipo}
                </div>
                {player.status.nota && (
                  <p className="mt-1 text-[12px] leading-relaxed text-ink">{player.status.nota}</p>
                )}
              </div>
            )}

            {/* Il rendimento dell'anno scorso arriva col listone: è già qui,
                senza attendere il caricamento della scheda. */}
            {prev ? (
              <div className="flex flex-col">
                <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-caps">Stagione {prev.season}</span>
                  <span className="font-mono text-[10px] text-muted">ultima conclusa</span>
                </div>
                <div className="flex items-stretch gap-3 border-b border-hair py-3">
                  <div className="flex flex-1 flex-col items-center justify-center border-[1.5px] border-campo py-2">
                    <span className="font-mono text-3xl font-semibold leading-none text-campo">
                      {formatAvg(prev.fantamedia)}
                    </span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-caps text-campo">Fantamedia</span>
                  </div>
                  <ul className="flex-1">
                    {prevSeasonEntries(prev, player.roleClassic).map(([label, value]) => (
                      <li
                        key={label}
                        className="flex items-baseline justify-between border-b border-hair py-1 last:border-b-0"
                      >
                        <span className="text-[12px] text-muted">{label}</span>
                        <span className="font-mono text-[13px] font-semibold">{value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="border-b border-hair pb-3 font-serif text-[13px] italic text-muted">
                Nessuna presenza in Serie A nell'ultima stagione: esordiente, arrivo dall'estero o rientro da un
                prestito.
              </p>
            )}

            {(!detail || detail.status === 'loading') && (
              <p className="font-serif italic text-muted">Caricamento…</p>
            )}

            {detail?.status === 'error' && <p className="text-granata">{detail.error}</p>}

            {detail?.status === 'ready' && (
              <>
                <div className="flex flex-col">
                  <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-caps">Stagione in corso</span>
                    <span className="font-mono text-[10px] text-muted">
                      MV {formatAvg(detail.data.mediaVoto)} · FM {formatAvg(detail.data.fantamedia)}
                    </span>
                  </div>
                  <ul>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <StatusRow key={key} label={label} value={detail.data.seasonStatus?.[key]} />
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-caps">Cronaca infortuni</span>
                    <span className="font-mono text-[10px] text-muted">fonte Transfermarkt</span>
                  </div>
                  {tm?.found && tm.injuries.length > 0 && (
                    <ul>
                      {tm.injuries.map((inj, i) => {
                        const days = parseDays(inj.giorni)
                        return (
                          <li
                            key={i}
                            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 border-b border-hair py-2 last:border-b-0"
                          >
                            <span className="truncate font-serif text-[15px] font-medium">{inj.tipo}</span>
                            <span className="font-mono text-[11px] text-muted">
                              {inj.da} → {inj.a}
                            </span>
                            <span
                              className={`w-14 text-right font-mono text-xs ${
                                days != null && days >= 30 ? 'font-semibold text-granata' : ''
                              }`}
                            >
                              {inj.giorni}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {tm?.found && tm.injuries.length === 0 && (
                    <p className="py-2.5 font-serif text-[13px] italic text-muted">
                      Nessun infortunio registrato su Transfermarkt.
                    </p>
                  )}
                  {tm && !tm.found && (
                    <p className="py-2.5 font-serif text-[13px] italic text-muted">
                      Calciatore non trovato con certezza su Transfermarkt (nome o squadra non corrispondenti).
                    </p>
                  )}
                </div>

                {detail.data.description && (
                  <p className="font-serif text-[13px] leading-relaxed text-muted">{detail.data.description}</p>
                )}
              </>
            )}

            <div className="flex flex-wrap justify-between gap-2 border-t-2 border-ink pt-3 text-[11px] font-bold uppercase tracking-caps">
              <a href={player.profileUrl} target="_blank" rel="noopener noreferrer" className="text-campo hover:text-ink">
                Scheda su fantacalcio.it ↗
              </a>
              {tm?.found && (
                <a
                  href={`https://www.transfermarkt.it/x/verletzungen/spieler/${tm.tmId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-campo hover:text-ink"
                >
                  Storico Transfermarkt ↗
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
