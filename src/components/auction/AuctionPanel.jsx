import { useEffect, useMemo, useState } from 'react'
import { useStore, useOpponentName } from '../../store.js'
import { computeSuggestedBid, penaltyRankBadge, hasReliableAverage } from '../../lib/engine.js'
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from '../../lib/roles.js'
import { formatAvg } from '../../lib/format.js'
import Badge, { STATUS_MARKS } from '../common/Badge.jsx'
import TakenForm from '../players/TakenForm.jsx'
import RivalsBlock from './RivalsBlock.jsx'

// Pannello del calciatore in asta: durante una serata d'asta il banditore chiama
// un nome e servono subito prezzo consigliato, rendimento e infortuni, senza
// aprire e chiudere finestre. Resta fisso a destra sugli schermi larghi.

const BID_NOTE = {
  'ruolo-completo': 'Hai già riempito tutti gli slot di questo ruolo.',
  'rosa-completa': 'Rosa completa: non ti servono altri calciatori.',
  'senza-quotazione': 'Senza quotazione ufficiale non posso consigliare un prezzo.',
}

function StatRow({ label, value }) {
  return (
    <li className="flex items-baseline justify-between border-b border-hair py-1.5 last:border-b-0">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="font-mono text-[13px] font-semibold">{value}</span>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <span className="font-serif text-lg italic text-muted">Nessun calciatore selezionato</span>
      <span className="text-[12px] leading-relaxed text-muted">
        Tocca un nome nel listone: qui compaiono prezzo consigliato, rendimento e infortuni.
      </span>
    </div>
  )
}

export default function AuctionPanel() {
  const selectedId = useStore((s) => s.selectedPlayerId)
  const players = useStore((s) => s.players)
  const draftByPlayerId = useStore((s) => s.draftByPlayerId)
  const leagueConfig = useStore((s) => s.leagueConfig)
  const markMine = useStore((s) => s.markMine)
  const freePlayer = useStore((s) => s.freePlayer)
  const detail = useStore((s) => (selectedId ? s.playerDetailsById[selectedId] : null))

  const player = useMemo(() => players.find((p) => p.id === selectedId), [players, selectedId])
  const bid = useMemo(
    () => (player ? computeSuggestedBid({ player, players, draftByPlayerId, leagueConfig }) : null),
    [player, players, draftByPlayerId, leagueConfig]
  )
  const [price, setPrice] = useState('')
  // Il form "a un altro" si chiude da solo quando cambia il calciatore in asta.
  const [assigning, setAssigning] = useState(false)
  useEffect(() => setAssigning(false), [selectedId])
  const entry = player ? draftByPlayerId[player.id] : null
  const ownerName = useOpponentName(entry?.ownerId)

  if (!player) return <EmptyState />

  const prev = player.prevSeason
  const penalty = penaltyRankBadge(player)
  const tm = detail?.data?.transfermarkt
  const suggested = bid?.value

  const handleMine = (e) => {
    e.preventDefault()
    markMine(player, price || suggested || player.quotazioneClassicAttuale)
    setPrice('')
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="text-[11px] font-bold uppercase tracking-caps text-granata">In asta ora</div>

      <div className="flex flex-col gap-1 border-b-2 border-ink pb-3">
        <div className="flex items-center gap-2.5">
          <Badge className={`h-7 w-7 text-[15px] ${ROLE_BADGE_CLASSES[player.roleClassic]}`}>
            {player.roleClassic}
          </Badge>
          <span className="font-serif text-[30px] font-medium leading-none text-ink">{player.name}</span>
        </div>
        <div className="text-[11px] font-bold uppercase tracking-caps text-muted">
          {player.team} · {ROLE_LABELS[player.roleClassic]}
          {penalty && <span className="text-campo"> · {penalty.title}</span>}
        </div>
      </div>

      {/* Chi è fermo adesso conta più dello storico: sta sopra al prezzo, perché
          cambia la decisione prima ancora di guardare quanto offrire. */}
      {player.status && (
        <div
          className={`border-l-[3px] px-3 py-2.5 ${
            player.status.tipo === 'diffidato' ? 'border-l-ocra bg-ocra/[0.08]' : 'border-l-granata bg-granata/[0.08]'
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

      {/* Il numero che serve mentre si rilancia. */}
      {suggested != null ? (
        <div className="flex flex-col items-center gap-0.5 bg-campo px-4 py-3.5 text-paper">
          <span className="font-mono text-[32px] font-semibold leading-none">fino a {suggested} cr</span>
          <span className="text-[10px] font-bold uppercase tracking-caps">
            Offerta consigliata
            {bid.reason === 'al-tetto' && ' · al tetto del budget'}
          </span>
          <span className="mt-1 text-[11px] opacity-90">
            {bid.vsQuotazione > 0
              ? `${bid.vsQuotazione} cr sopra il listino: vale un rilancio`
              : bid.vsQuotazione < 0
                ? `${-bid.vsQuotazione} cr sotto il listino: non strapagarlo`
                : 'in linea col listino'}
          </span>
        </div>
      ) : (
        <div className="border-[1.5px] border-ocra px-4 py-3 text-center text-[12px] text-ocra">
          {BID_NOTE[bid?.reason] || 'Nessun consiglio disponibile.'}
        </div>
      )}

      {!entry && suggested != null && <RivalsBlock player={player} />}

      <div className="grid grid-cols-3 gap-2.5">
        {[
          ['Quot.', player.quotazioneClassicAttuale, 'text-ink'],
          ['FVM', player.fvmClassic, 'text-ink'],
          ['FM 25/26', prev ? formatAvg(prev.fantamedia) : '—', prev && prev.fantamedia >= 7 ? 'text-campo' : 'text-ink'],
        ].map(([label, value, color]) => (
          <div key={label} className="flex flex-col items-center gap-0.5 border border-hair py-2">
            <span className={`font-mono text-[19px] font-semibold ${color}`}>{value}</span>
            <span className="text-[9px] font-bold uppercase tracking-caps text-muted">{label}</span>
          </div>
        ))}
      </div>

      {prev ? (
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-caps">Stagione {prev.season}</span>
            {!hasReliableAverage(prev) && (
              <span className="font-mono text-[10px] text-ocra">poche presenze</span>
            )}
          </div>
          <ul>
            <StatRow label="Presenze" value={prev.presenze} />
            <StatRow label="Media voto" value={formatAvg(prev.mediaVoto)} />
            {player.roleClassic === 'P' ? (
              <>
                <StatRow label="Gol subiti" value={prev.golSubiti ?? '—'} />
                <StatRow label="Rigori parati" value={prev.rigoriParati ?? '—'} />
              </>
            ) : (
              <>
                <StatRow label="Gol" value={prev.gol ?? '—'} />
                <StatRow label="Assist" value={prev.assist ?? '—'} />
              </>
            )}
            {prev.rigoriCalciati > 0 && (
              <StatRow label="Rigori" value={`${prev.rigoriSegnati}/${prev.rigoriCalciati}`} />
            )}
          </ul>
        </div>
      ) : (
        <p className="font-serif text-[13px] italic text-muted">
          Nessuna presenza in Serie A l'anno scorso: esordiente o arrivo dall'estero.
        </p>
      )}

      <div className="flex flex-col">
        <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-caps">Infortuni</span>
          <span className="font-mono text-[10px] text-muted">Transfermarkt</span>
        </div>
        {(!detail || detail.status === 'loading') && (
          <p className="py-2 font-serif text-[13px] italic text-muted">Caricamento…</p>
        )}
        {detail?.status === 'ready' && tm?.found && tm.injuries.length > 0 && (
          <ul>
            {tm.injuries.slice(0, 4).map((inj, i) => {
              const days = Number(String(inj.giorni).match(/\d+/)?.[0])
              return (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-2 border-b border-hair py-1.5 last:border-b-0"
                >
                  <span className="truncate text-[12px]">{inj.tipo}</span>
                  <span
                    className={`shrink-0 font-mono text-[11px] ${days >= 30 ? 'font-semibold text-granata' : 'text-muted'}`}
                  >
                    {inj.giorni}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {detail?.status === 'ready' && tm?.found && tm.injuries.length === 0 && (
          <p className="py-2 font-serif text-[13px] italic text-muted">Nessun infortunio registrato.</p>
        )}
        {/* rowsSeen a 0 vuol dire che la ricerca non ha risposto affatto (Transfermarkt
            rifiuta le richieste dai server): diverso dal non aver trovato il calciatore. */}
        {detail?.status === 'ready' && tm && !tm.found && (
          <p className="py-2 font-serif text-[13px] italic leading-relaxed text-muted">
            {tm.rowsSeen === 0
              ? 'Transfermarkt non risponde alle richieste del server.'
              : 'Calciatore non trovato con certezza (nome o squadra non corrispondenti).'}{' '}
            <a
              href={`https://www.transfermarkt.it/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(player.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-[11px] font-bold uppercase not-italic tracking-caps text-campo hover:text-ink"
            >
              Cerca ↗
            </a>
          </p>
        )}
        {detail?.status === 'error' && <p className="py-2 text-[12px] text-granata">{detail.error}</p>}
      </div>

      <div className="flex-1" />

      {entry ? (
        <div className="flex items-center justify-between gap-3 border-t-2 border-ink pt-3">
          <span className="text-[11px] font-bold uppercase tracking-caps text-campo">
            {entry.status === 'mine'
              ? `Preso da te · ${entry.price} cr`
              : `${ownerName ? `Preso da ${ownerName}` : 'Preso da un avversario'}${entry.price != null ? ` · ${entry.price} cr` : ''}`}
          </span>
          <button
            onClick={() => freePlayer(player.id, player.name)}
            className="h-9 rounded-[2px] border-[1.5px] border-muted px-4 text-[11px] font-bold uppercase tracking-caps text-muted hover:border-ink hover:text-ink"
          >
            Libera
          </button>
        </div>
      ) : assigning ? (
        <TakenForm
          player={player}
          layout="panel"
          onDone={() => setAssigning(false)}
          onCancel={() => setAssigning(false)}
        />
      ) : (
        <form onSubmit={handleMine} className="flex flex-col gap-2.5 border-t-2 border-ink pt-3">
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={String(suggested ?? player.quotazioneClassicAttuale ?? 1)}
              className="w-24 rounded-[2px] border-[1.5px] border-ink bg-transparent px-3 py-2.5 text-center font-mono text-[17px] focus:border-campo focus:outline-none"
              aria-label="Prezzo pagato"
            />
            <button
              type="submit"
              className="h-12 flex-1 rounded-[2px] bg-ink text-[11px] font-bold uppercase tracking-caps text-paper shadow-press hover:opacity-90"
            >
              L'ho preso io
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAssigning(true)}
            className="h-11 rounded-[2px] border-[1.5px] border-ink text-[11px] font-bold uppercase tracking-caps text-ink hover:bg-ink/5"
          >
            A un altro
          </button>
        </form>
      )}
    </div>
  )
}
