/*
 * Riepilogo dell'ultima stagione per chi NON l'ha giocata in Serie A, da
 * eseguire DAL MAC (come `fetch-tm-ids.mjs`, di cui riusa la mappa id).
 *
 * Nel listone di fantacalcio.it questi calciatori non hanno statistiche: sono i
 * circa 190 arrivati dall'estero, dalla Serie B o dal vivaio, e all'asta si
 * presentano come pagine bianche. Transfermarkt però le sue partite le ha
 * contate: `performance-season` restituisce la carriera aggregata per stagione,
 * competizione e club — 50 KB contro gli oltre 1200 della versione partita per
 * partita, che sarebbe insostenibile per 190 calciatori.
 *
 * Perché un file statico e non una chiamata al volo: il dato serve nel LISTONE,
 * cioè per tutti insieme, e una stagione conclusa non cambia più. Si rigenera
 * col mercato di gennaio, insieme alla mappa.
 *
 *   node scripts/fetch-abroad-stats.mjs [--force] [--limit N]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IDS = resolve(ROOT, 'functions/data/transfermarkt-ids.json')
const OUT = resolve(ROOT, 'functions/data/prev-season-abroad.json')
const QUOTAZIONI_API = 'https://fantacalcio-asta-tb.web.app/api/quotazioni'
const TM_API = 'https://tmapi.transfermarkt.technology'
const THROTTLE_MS = 300

// Stagione conclusa nel formato di Transfermarkt: l'id è l'anno d'inizio, e il
// campionato comincia in agosto (stesso calcolo della Cloud Function).
function previousSeason(now = new Date()) {
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  const prev = startYear - 1
  return { id: prev, label: `${prev}-${String(prev + 1).slice(2)}` }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function tmApi(path) {
  const res = await fetch(`${TM_API}${path}`, {
    headers: { Accept: 'application/json', Referer: 'https://www.transfermarkt.it/' },
  })
  if (!res.ok) throw new Error(`tmapi ${path}: HTTP ${res.status}`)
  const body = await res.json()
  if (!body?.success) throw new Error(`tmapi ${path}: risposta senza successo`)
  return body.data
}

// I nomi di club e competizioni costano una richiesta ciascuno, ma si ripetono
// molto: due sole cache evitano centinaia di chiamate inutili.
const clubCache = new Map()
const competitionCache = new Map()

async function clubName(clubId) {
  if (!clubCache.has(clubId)) {
    try {
      clubCache.set(clubId, (await tmApi(`/club/${clubId}`))?.name || null)
    } catch {
      clubCache.set(clubId, null)
    }
    await sleep(THROTTLE_MS)
  }
  return clubCache.get(clubId)
}

async function competition(competitionId) {
  if (!competitionCache.has(competitionId)) {
    try {
      const data = await tmApi(`/competition/${competitionId}`)
      competitionCache.set(competitionId, { name: data?.shortName || data?.name || null, typeId: data?.typeId ?? null })
    } catch {
      competitionCache.set(competitionId, { name: null, typeId: null })
    }
    await sleep(THROTTLE_MS)
  }
  return competitionCache.get(competitionId)
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// Fino al settore giovanile è un campionato; oltre sono coppe.
const LEAGUE_MAX_TYPE_ID = 7

// Si tiene solo il calcio di club: campionati di ogni livello (1-7), coppe
// nazionali (8), supercoppe (9 e 13), competizioni europee (10) e coppe di lega
// (14). Restano fuori le nazionali, che hanno tipi propri — 11 amichevoli e
// Mondiale, 19 qualificazioni europee, 20 Under 21 — e non dicono nulla su come
// rendeva nel club che stiamo valutando. È scritta come lista di ciò che entra,
// non di ciò che si esclude: una competizione mai vista prima resta fuori invece
// di entrare per sbaglio.
const CLUB_COMPETITION_TYPE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14])

// Sotto questa soglia il secondo club è rumore (un cameo nell'Under 21 del
// proprio club), non una seconda mezza stagione.
const MIN_OTHER_CLUB_APPEARANCES = 3

// Una stagione può essere sparsa su più competizioni e anche su due club (chi si
// è mosso a gennaio). La riga principale è il CAMPIONATO con più presenze: è il
// metro di paragone con la Serie A, e dice da dove uno arriva davvero. Coppe e
// spezzoni altrove finiscono in un totale a parte, senza sparire.
//
// Transfermarkt classifica le competizioni con typeId: 1 prima divisione, 2 e 3
// le inferiori (Serie B, Serie C), 7 i campionati giovanili (Primavera), da 8 in
// su le coppe nazionali e internazionali. Un campionato di Serie B o di
// Primavera resta una stagione giocata; una sola presenza in Coppa Italia no, e
// va detto.
async function summarize(performance, seasonId, nationalTeamIds) {
  const rows = performance.filter((p) => p.generalInformation?.seasonId === seasonId)
  if (!rows.length) return null

  const enriched = []
  for (const row of rows) {
    const info = row.generalInformation
    const time = row.statistics?.playingTimeStatistics || {}
    const goals = row.statistics?.goalStatistics || {}
    const cards = row.statistics?.cardStatistics || {}
    const comp = await competition(info.competitionId)
    enriched.push({
      competitionId: info.competitionId,
      competition: comp.name,
      typeId: comp.typeId,
      clubId: info.clubId,
      presenze: num(time.appearancesCount),
      titolare: num(time.startingCount),
      minuti: num(time.playedMinutesSum),
      gol: num(goals.goalsSum),
      assist: num(goals.assistsSum),
      golSubiti: num(goals.opponentGoalsOnThePitch),
      rigoriParati: num(goals.penaltyGoalkeeperSaves),
      ammonizioni: num(cards.yellowCardNetSum),
      espulsioni: num(cards.redCardsCount) + num(cards.yellowRedCardsCount),
    })
  }

  const played = enriched.filter(
    (e) => e.presenze > 0 && !nationalTeamIds.has(e.clubId) && CLUB_COMPETITION_TYPE_IDS.has(e.typeId)
  )
  if (!played.length) return null

  const leagues = played.filter((e) => e.typeId != null && e.typeId <= LEAGUE_MAX_TYPE_ID)
  const main = (leagues.length ? leagues : played).sort((a, b) => b.presenze - a.presenze)[0]
  // Le coppe sono quelle giocate CON QUEL club: sommarci le partite fatte
  // altrove prima di gennaio farebbe un numero che non descrive nessuno.
  const others = played.filter((e) => e !== main && e.clubId === main.clubId)
  const elsewhere = played.filter((e) => e.clubId !== main.clubId)

  return {
    club: await clubName(main.clubId),
    competition: main.competition,
    competitionId: main.competitionId,
    // true quando nemmeno la riga principale è un campionato: chi ha solo
    // qualche presenza in coppa non ha fatto una stagione, e l'app lo dirà.
    coppa: !(main.typeId != null && main.typeId <= LEAGUE_MAX_TYPE_ID),
    // La prima divisione è un altro sport rispetto alla Serie C: serve a chi
    // legge per pesare le presenze.
    primaDivisione: main.typeId === 1,
    presenze: main.presenze,
    titolare: main.titolare,
    minuti: main.minuti,
    gol: main.gol,
    assist: main.assist,
    golSubiti: main.golSubiti,
    rigoriParati: main.rigoriParati,
    ammonizioni: main.ammonizioni,
    espulsioni: main.espulsioni,
    altre: others.length
      ? {
          competizioni: others.length,
          presenze: others.reduce((s, e) => s + e.presenze, 0),
          gol: others.reduce((s, e) => s + e.gol, 0),
          assist: others.reduce((s, e) => s + e.assist, 0),
        }
      : null,
    // Chi si è mosso a gennaio ha due mezze stagioni: la seconda squadra va
    // nominata, altrimenti il riepilogo racconta solo metà anno.
    altroClub: elsewhere.reduce((sum, e) => sum + e.presenze, 0) >= MIN_OTHER_CLUB_APPEARANCES
      ? {
          club: await clubName(elsewhere.sort((a, b) => b.presenze - a.presenze)[0].clubId),
          presenze: elsewhere.reduce((s, e) => s + e.presenze, 0),
          gol: elsewhere.reduce((s, e) => s + e.gol, 0),
        }
      : null,
  }
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity

const season = previousSeason()
const tmIds = JSON.parse(readFileSync(IDS, 'utf8')).byId
const { players } = await fetch(QUOTAZIONI_API).then((r) => r.json())

const out =
  !force && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { generatedAt: null, season: season.label, byId: {} }
out.byId ||= {}
out.season = season.label

// Solo chi nel listone non ha statistiche di Serie A: per gli altri il dato
// ufficiale di fantacalcio.it resta la fonte migliore.
const todo = players.filter(
  (p) => !p.ceduto && !p.prevSeason && tmIds[p.id] && (force || !(p.id in out.byId))
).slice(0, limit)
console.log(`Stagione ${season.label} (id ${season.id}) — da recuperare: ${todo.length}`)

let withData = 0
let empty = 0
for (const player of todo) {
  try {
    const tmId = tmIds[player.id].tmId
    const profile = await tmApi(`/player/${tmId}`)
    const nationalTeamIds = new Set(
      (profile?.clubAssignments || []).filter((a) => a.type === 'nationalTeam').map((a) => a.clubId)
    )
    await sleep(THROTTLE_MS)
    const data = await tmApi(`/player/${tmId}/performance-season`)
    const summary = await summarize(data?.performance || [], season.id, nationalTeamIds)
    // Anche il "niente" va registrato: senza, ogni riesecuzione riproverebbe
    // all'infinito i giovani che davvero non hanno giocato.
    out.byId[player.id] = summary
    if (summary) {
      withData += 1
      const extra = summary.altre ? ` (+${summary.altre.presenze} in coppa)` : ''
      console.log(`  ${player.name} (${player.team}) — ${summary.presenze} pres, ${summary.gol} gol · ${summary.club}, ${summary.competition}${extra}`)
    } else {
      empty += 1
    }
  } catch (err) {
    console.log(`  ! ${player.name}: ${err.message}`)
  }
  if ((withData + empty) % 25 === 0) {
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify({ ...out, generatedAt: new Date().toISOString() }, null, 0))
  }
  await sleep(THROTTLE_MS)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ ...out, generatedAt: new Date().toISOString() }, null, 0))
console.log(`\nFatto: ${withData} con dati, ${empty} senza partite nel ${season.label}.`)
console.log(OUT)
