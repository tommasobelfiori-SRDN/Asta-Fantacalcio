/*
 * Cloud Functions per l'assistente asta fantacalcio.
 *
 * `quotazioni`: recupera tre pagine pubbliche di fantacalcio.it (nessun login
 * richiesto) e le trasforma in un elenco JSON di calciatori: quotazioni (ruoli,
 * prezzi, FVM Classic e Mantra), rigoristi (gerarchia dei tiratori di rigore per
 * squadra) e statistiche dell'ULTIMA STAGIONE CONCLUSA (presenze, medie, gol,
 * assist, cartellini), unite per id calciatore. Chiamata dal bottone "Aggiorna
 * quotazioni".
 *
 * `dettagliGiocatore`: recupera la scheda di UN calciatore specifico, on-demand,
 * quando l'utente vuole approfondire durante l'asta (vedi commento più sotto).
 *
 * Entrambe on-demand, mai in polling automatico.
 */
const { onRequest } = require('firebase-functions/v2/https')
const { defineInt } = require('firebase-functions/params')
const cheerio = require('cheerio')

const QUOTAZIONI_URL = 'https://www.fantacalcio.it/quotazioni-fantacalcio'
const RIGORISTI_URL = 'https://www.fantacalcio.it/rigoristi-serie-a'
const STATISTICHE_URL = 'https://www.fantacalcio.it/statistiche-serie-a'
const FETCH_TIMEOUT_MS = 20_000
const MAX_INVALID_ROW_RATIO = 0.1
const CLASSIC_ROLE_MAP = { p: 'P', d: 'D', c: 'C', a: 'A' }

// Soglie minime di sanità: sotto queste soglie trattiamo la risposta come
// sospetta (probabile restyling del sito) invece di restituire dati incompleti.
// Ritarabili senza redeploy via functions/.env.
const MIN_EXPECTED_ROWS = defineInt('MIN_EXPECTED_ROWS', { default: 400 }) // oggi ~527 calciatori
const MIN_EXPECTED_TEAMS = defineInt('MIN_EXPECTED_TEAMS', { default: 15 }) // 20 squadre Serie A
const MIN_EXPECTED_STATS_ROWS = defineInt('MIN_EXPECTED_STATS_ROWS', { default: 400 }) // ~663 a fine stagione

// Etichetta dell'ultima stagione CONCLUSA, nel formato del sito ("2025-26").
// Il campionato inizia in agosto: da luglio in poi la stagione in corso è
// quella che apre nell'anno solare corrente, quindi la conclusa è la precedente.
function previousSeasonLabel(now = new Date()) {
  const year = now.getFullYear()
  const seasonStartYear = now.getMonth() >= 6 ? year : year - 1 // getMonth: 6 = luglio
  const prev = seasonStartYear - 1
  return `${prev}-${String(prev + 1).slice(2)}`
}

class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

async function fetchHtml(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FantacalcioAstaAssistant/1.0 (uso personale)',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
    })
    if (!res.ok) {
      throw new UpstreamError(`${url} ha risposto con status ${res.status}`)
    }
    return await res.text()
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new UpstreamError(`Timeout nel contattare ${url}`)
    }
    if (err instanceof UpstreamError) throw err
    throw new UpstreamError(`Errore di rete verso ${url}: ${err.message}`)
  } finally {
    clearTimeout(timeout)
  }
}

// L'id sta in fondo all'URL del profilo (".../fiorentina/kean/2097"), ma nelle
// pagine di una stagione passata segue un suffisso stagione
// (".../roma/malen/5585/2025-26"): va saltato, altrimenti l'id non si estrae.
function extractPlayerId(href) {
  if (!href) return null
  const match = href.match(/\/(\d+)(?:\/\d{4}-\d{2})?\/?$/)
  return match ? match[1] : null
}

function parseNumber(text) {
  const n = Number(String(text || '').trim())
  return Number.isFinite(n) ? n : null
}

// Selettori basati sugli attributi data-* / data-col-key (meno soggetti a rotture
// per un futuro restyling grafico rispetto alle classi CSS).
function parsePlayers(html, minExpectedRows) {
  const $ = cheerio.load(html)
  const rows = $('tr.player-row')
  const warnings = []

  if (rows.length < minExpectedRows) {
    throw new UpstreamError(
      `Trovate solo ${rows.length} righe calciatori (attese almeno ${minExpectedRows}): probabile cambio di struttura della pagina quotazioni di fantacalcio.it`
    )
  }

  const players = []
  rows.each((_, el) => {
    try {
      const $row = $(el)
      const roleClassicRaw = ($row.attr('data-filter-role-classic') || '').toLowerCase()
      const roleClassic = CLASSIC_ROLE_MAP[roleClassicRaw]
      const roleMantra = ($row.attr('data-filter-role-mantra') || '')
        .split('|')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean)

      const nameLink = $row.find('a.player-name')
      const name = nameLink.find('span').first().text().trim() || nameLink.text().trim()
      const profileUrl = nameLink.attr('href') || null
      const id = extractPlayerId(profileUrl)
      const team = $row.find('[data-col-key="sq"]').text().trim()

      if (!id || !name || !roleClassic) {
        warnings.push(`Riga scartata (dati mancanti): id=${id ?? '?'} name="${name}" role="${roleClassicRaw}"`)
        return
      }

      players.push({
        id,
        name,
        team,
        roleClassic,
        roleMantra,
        profileUrl,
        quotazioneClassicIniziale: parseNumber($row.find('[data-col-key="c_qi"]').text()),
        quotazioneClassicAttuale: parseNumber($row.find('[data-col-key="c_qa"]').text()),
        fvmClassic: parseNumber($row.find('[data-col-key="c_fvm"]').text()),
        quotazioneMantraIniziale: parseNumber($row.find('[data-col-key="m_qi"]').text()),
        quotazioneMantraAttuale: parseNumber($row.find('[data-col-key="m_qa"]').text()),
        fvmMantra: parseNumber($row.find('[data-col-key="m_fvm"]').text()),
      })
    } catch (rowErr) {
      warnings.push(`Riga scartata (errore parsing): ${rowErr.message}`)
    }
  })

  if (players.length < rows.length * (1 - MAX_INVALID_ROW_RATIO)) {
    throw new UpstreamError(
      `Solo ${players.length}/${rows.length} righe valide: probabile cambio di struttura della pagina quotazioni di fantacalcio.it`
    )
  }

  return { players, warnings }
}

// Ogni squadra è una .team-card con una .col "Rigori" contenente un <ol> ordinato
// (1° li = rigorista titolare, 2° = secondo, ...). A differenza delle quotazioni,
// un problema qui non deve bloccare l'intera risposta: è un arricchimento, non il
// dato principale. Ritorna una mappa id -> rango (1-based) invece di lanciare, a
// parte per lo stesso controllo di sanità sul numero di squadre trovate.
function parseRigoristi(html, minExpectedTeams) {
  const $ = cheerio.load(html)
  const teamCards = $('.team-card')
  const warnings = []
  const penaltyRankById = new Map()

  if (teamCards.length < minExpectedTeams) {
    warnings.push(
      `Pagina rigoristi: trovate solo ${teamCards.length} squadre (attese almeno ${minExpectedTeams}) — dati rigoristi ignorati, probabile cambio di struttura`
    )
    return { penaltyRankById, warnings }
  }

  teamCards.each((_, teamEl) => {
    const rigoriCol = $(teamEl)
      .find('.col')
      .filter((__, col) => $(col).find('header').first().text().trim().toLowerCase() === 'rigori')
      .first()
    if (!rigoriCol.length) return

    rigoriCol.find('ol.pill-list li a.player-name').each((rankIndex, linkEl) => {
      const id = extractPlayerId($(linkEl).attr('href'))
      if (id && !penaltyRankById.has(id)) {
        penaltyRankById.set(id, rankIndex + 1)
      }
    })
  })

  return { penaltyRankById, warnings }
}

// Statistiche dell'ultima stagione conclusa: stessa struttura `tr.player-row`
// delle quotazioni, ma con le colonne di rendimento. La stagione si sceglie dal
// PERCORSO (`/statistiche-serie-a/2025-26`); una query string verrebbe ignorata
// e restituirebbe la stagione in corso — errore silenzioso, quindi mai usarla.
//
// Come i rigoristi, è un arricchimento: un problema qui non deve far fallire le
// quotazioni. Le medie sono numeri italiani ("6,72") e i rigori una frazione
// ("3 / 4"), quindi non passano da parseNumber.
const STAT_COLS = {
  presenze: 'pg',
  gol: 'gol',
  golSubiti: 'gs',
  rigoriParati: 'rp',
  assist: 'ass',
  ammonizioni: 'amm',
  espulsioni: 'esp',
}

function parseStatistiche(html, minExpectedRows, season) {
  const $ = cheerio.load(html)
  const rows = $('tr.player-row')
  const warnings = []
  const statsById = new Map()

  if (rows.length < minExpectedRows) {
    warnings.push(
      `Statistiche ${season}: trovate solo ${rows.length} righe (attese almeno ${minExpectedRows}) — dati stagione precedente ignorati, probabile cambio di struttura`
    )
    return { statsById, warnings }
  }

  rows.each((_, el) => {
    try {
      const $row = $(el)
      const id = extractPlayerId($row.find('a.player-name').attr('href'))
      if (!id || statsById.has(id)) return

      const cell = (key) => $row.find(`[data-col-key="${key}"]`).text().trim()
      const stat = { season }
      for (const [field, key] of Object.entries(STAT_COLS)) {
        stat[field] = parseNumber(cell(key))
      }
      stat.mediaVoto = parseItalianNumber(cell('mv'))
      stat.fantamedia = parseItalianNumber(cell('mfv'))

      // "3 / 4" = rigori segnati su calciati.
      const rig = cell('rig').match(/(\d+)\s*\/\s*(\d+)/)
      stat.rigoriSegnati = rig ? Number(rig[1]) : null
      stat.rigoriCalciati = rig ? Number(rig[2]) : null

      // Chi non ha mai giocato in Serie A quella stagione non porta informazione.
      if (stat.presenze) statsById.set(id, stat)
    } catch (rowErr) {
      warnings.push(`Statistiche ${season}: riga scartata (${rowErr.message})`)
    }
  })

  return { statsById, warnings }
}

async function quotazioniHandler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo non consentito.' })
    return
  }
  try {
    const season = previousSeasonLabel()
    const [quotazioniHtml, rigoristiHtml, statisticheHtml] = await Promise.all([
      fetchHtml(QUOTAZIONI_URL),
      fetchHtml(RIGORISTI_URL).catch((err) => {
        console.error('Errore recupero rigoristi (non bloccante):', err)
        return null
      }),
      fetchHtml(`${STATISTICHE_URL}/${season}`).catch((err) => {
        console.error(`Errore recupero statistiche ${season} (non bloccante):`, err)
        return null
      }),
    ])

    const { players, warnings } = parsePlayers(quotazioniHtml, MIN_EXPECTED_ROWS.value())

    let penaltyRankById = new Map()
    let rigoristiWarnings = []
    if (rigoristiHtml) {
      const parsed = parseRigoristi(rigoristiHtml, MIN_EXPECTED_TEAMS.value())
      penaltyRankById = parsed.penaltyRankById
      rigoristiWarnings = parsed.warnings
    } else {
      rigoristiWarnings = [
        'Impossibile recuperare i dati sui rigoristi: le quotazioni restano comunque disponibili senza questa informazione.',
      ]
    }

    let statsById = new Map()
    let statsWarnings = []
    if (statisticheHtml) {
      const parsed = parseStatistiche(statisticheHtml, MIN_EXPECTED_STATS_ROWS.value(), season)
      statsById = parsed.statsById
      statsWarnings = parsed.warnings
    } else {
      statsWarnings = [
        `Impossibile recuperare le statistiche ${season}: le quotazioni restano comunque disponibili senza questa informazione.`,
      ]
    }

    for (const player of players) {
      player.penaltyRank = penaltyRankById.get(player.id) ?? null
      // Assente per chi non ha giocato in Serie A quella stagione (neopromossi,
      // arrivi dall'estero, giovani): il frontend lo mostra come "esordiente".
      player.prevSeason = statsById.get(player.id) ?? null
    }

    const allWarnings = [...warnings, ...rigoristiWarnings, ...statsWarnings]
    res.status(200).json({
      players,
      count: players.length,
      previousSeason: season,
      fetchedAt: new Date().toISOString(),
      warnings: allWarnings.length ? allWarnings.slice(0, 20) : undefined,
    })
  } catch (err) {
    console.error('Errore recupero quotazioni:', err)
    const status = Number.isInteger(err.status) ? err.status : 500
    res.status(status).json({
      error:
        "Impossibile recuperare le quotazioni in questo momento. Riprova più tardi, oppure continua a usare l'ultimo aggiornamento salvato.",
    })
  }
}

// --- Dettaglio on-demand di un singolo calciatore ---
//
// A differenza di quotazioni/rigoristi (2 pagine per l'intero listone), qui NON
// si scaricano le schede di tutti i 500+ calciatori ad ogni "Aggiorna quotazioni":
// sarebbe un carico enorme e sproporzionato verso fantacalcio.it. Il frontend
// chiama questo endpoint solo quando l'utente apre volontariamente il dettaglio
// di UN calciatore specifico durante l'asta.
//
// La scheda fantacalcio.it non ha una cronologia infortuni né statistiche delle
// stagioni passate in forma tabellare (solo grafici SVG per voto/prezzo/FVM nel
// tempo, non affidabilmente estraibili). Ha però una sezione "Riepilogo stagione"
// con dati strutturati (schema.org PropertyValue) su presenze da titolare,
// subentri, squalifiche, infortuni e utilizzo nella stagione in corso, più media
// voto e fantamedia correnti: è quello che restituiamo da lì.
//
// La cronaca infortuni vera e propria (tipo, date, giorni, partite perse) viene
// invece da Transfermarkt, che la pubblica come tabella pulita (a differenza di
// fantacalcio.it, dove è prosa editoriale non affidabilmente parsabile). Il
// problema è collegare i due siti: Transfermarkt ha ID propri, diversi da quelli
// fantacalcio.it. Si cerca il giocatore per nome e si accetta il risultato SOLO
// se la sua squadra su Transfermarkt corrisponde a quella fantacalcio.it nota:
// meglio nessun dato che il rischio di mostrare l'infortunio di un omonimo.
const FANTACALCIO_ORIGIN = 'https://www.fantacalcio.it'
const PROFILE_PATH_RE = /^\/serie-a\/squadre\/[^/]+\/[^/]+\/\d+\/?$/

function isValidProfileUrl(raw) {
  try {
    const u = new URL(raw)
    return u.origin === FANTACALCIO_ORIGIN && PROFILE_PATH_RE.test(u.pathname)
  } catch {
    return false
  }
}

function parseItalianNumber(text) {
  return parseNumber(String(text || '').replace(',', '.'))
}

// Formato osservato: "12 - 45%" oppure "12 - 45" (il simbolo % a volte sta fuori
// dallo span): partite nella categoria - percentuale sul totale.
function parseSeasonStatusValue(text) {
  const match = String(text || '').match(/(\d+)\s*-\s*(\d+)\s*%?/)
  if (!match) return { raw: String(text || '').trim() || null, count: null, percent: null }
  return { raw: null, count: Number(match[1]), percent: Number(match[2]) }
}

const SEASON_STATUS_KEYS = {
  titolare: 'titolare',
  entrato: 'entrato',
  squalificato: 'squalificato',
  infortunato: 'infortunato',
  inutilizzato: 'inutilizzato',
}

function parsePlayerDetails(html) {
  const $ = cheerio.load(html)

  const mediaVoto = parseItalianNumber($('.player-stats li[title="Media Voto"] .badge').first().text())
  const fantamedia = parseItalianNumber($('.player-stats li[title="Fantamedia"] .badge').first().text())

  const seasonStatus = {}
  $('.donut-summary li').each((_, li) => {
    const label = $(li).find('[itemprop="name description"]').first().text().trim().toLowerCase()
    const key = SEASON_STATUS_KEYS[label]
    if (!key) return
    seasonStatus[key] = parseSeasonStatusValue($(li).find('[itemprop="value"]').first().text())
  })

  const description = $('.description').first().text().trim() || null

  return { mediaVoto, fantamedia, seasonStatus, description }
}

// --- Cronaca infortuni da Transfermarkt ---

const TM_SEARCH_URL = 'https://www.transfermarkt.it/schnellsuche/ergebnis/schnellsuche'

// Parola chiave distintiva per ciascuna squadra, usata per confermare il match:
// Transfermarkt scrive il nome ufficiale per esteso (es. "ACF Fiorentina", "AS
// Roma", "AC Milan"), quindi si verifica che lo contenga, non l'uguaglianza.
const TM_TEAM_KEYWORDS = {
  ATA: 'Atalanta',
  BOL: 'Bologna',
  CAG: 'Cagliari',
  COM: 'Como',
  FIO: 'Fiorentina',
  FRO: 'Frosinone',
  GEN: 'Genoa',
  INT: 'Inter',
  JUV: 'Juventus',
  LAZ: 'Lazio',
  LEC: 'Lecce',
  MIL: 'Milan',
  MON: 'Monza',
  NAP: 'Napoli',
  PAR: 'Parma',
  ROM: 'Roma',
  SAS: 'Sassuolo',
  TOR: 'Torino',
  UDI: 'Udinese',
  VEN: 'Venezia',
}

// fantacalcio.it disambigua gli omonimi con un'iniziale finale (es. "Martinez L."):
// Transfermarkt non conosce questa convenzione, quindi la si toglie per la ricerca.
function cleanSearchName(name) {
  return String(name || '')
    .replace(/\s+[A-Z]\.$/, '')
    .trim()
}

function extractTmPlayerId(href) {
  const match = String(href || '').match(/\/spieler\/(\d+)/)
  return match ? match[1] : null
}

async function findTransfermarktPlayer(name, teamCode) {
  const teamKeyword = TM_TEAM_KEYWORDS[teamCode]
  if (!teamKeyword) return null

  const query = cleanSearchName(name)
  if (!query) return null

  const html = await fetchHtml(`${TM_SEARCH_URL}?query=${encodeURIComponent(query)}`)
  const $ = cheerio.load(html)
  const rows = $('table.items').first().find('> tbody > tr').toArray()

  for (const el of rows) {
    const $row = $(el)
    const playerLink = $row.find('a[href*="/profil/spieler/"]').first()
    const teamLink = $row.find('a[href*="/startseite/verein/"]').first()
    const tmId = extractTmPlayerId(playerLink.attr('href'))
    const teamName = teamLink.attr('title') || teamLink.text().trim()
    if (tmId && teamName.toLowerCase().includes(teamKeyword.toLowerCase())) {
      return { tmId, tmName: playerLink.attr('title') || playerLink.text().trim() }
    }
  }
  return null // nessuna riga con la squadra giusta: meglio niente che un omonimo sbagliato
}

// L'URL di Transfermarkt ignora lo slug testuale e usa solo l'id numerico finale
// (verificato: /x/verletzungen/spieler/364135 funziona) — evita di dover
// ricostruire lo slug esatto del nome.
function parseInjuryHistory(html) {
  const $ = cheerio.load(html)
  const rows = $('table.items').first().find('> tbody > tr').toArray()
  const injuries = []
  for (const el of rows) {
    const cells = $(el).find('> td')
    if (cells.length < 5) continue
    injuries.push({
      stagione: $(cells[0]).text().trim(),
      tipo: $(cells[1]).text().trim(),
      da: $(cells[2]).text().trim(),
      a: $(cells[3]).text().trim(),
      giorni: $(cells[4]).text().trim(),
    })
  }
  return injuries.slice(0, 15) // storico recente, non serve l'intera carriera
}

// Non bloccante per design: se Transfermarkt non risponde, cambia struttura, o
// il giocatore non si trova con certezza, si torna { found: false } — i dati
// fantacalcio.it restano comunque disponibili.
async function fetchTransfermarktInjuries(name, teamCode) {
  const match = await findTransfermarktPlayer(name, teamCode)
  if (!match) return { found: false }
  const html = await fetchHtml(`https://www.transfermarkt.it/x/verletzungen/spieler/${match.tmId}`)
  return { found: true, tmId: match.tmId, tmName: match.tmName, injuries: parseInjuryHistory(html) }
}

async function dettagliGiocatoreHandler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo non consentito.' })
    return
  }
  const url = req.query.url
  const name = req.query.name
  const team = req.query.team
  if (typeof url !== 'string' || !isValidProfileUrl(url)) {
    res.status(400).json({ error: 'URL calciatore non valido.' })
    return
  }
  try {
    const [html, transfermarkt] = await Promise.all([
      fetchHtml(url),
      typeof name === 'string' && typeof team === 'string'
        ? fetchTransfermarktInjuries(name, team).catch((err) => {
            console.error('Errore recupero infortuni Transfermarkt (non bloccante):', err)
            return { found: false }
          })
        : Promise.resolve({ found: false }),
    ])
    res.status(200).json({ ...parsePlayerDetails(html), transfermarkt })
  } catch (err) {
    console.error('Errore recupero dettagli calciatore:', err)
    const status = Number.isInteger(err.status) ? err.status : 500
    res.status(status).json({ error: 'Impossibile recuperare i dettagli del calciatore in questo momento.' })
  }
}

exports.quotazioni = onRequest(
  { region: 'europe-west1', timeoutSeconds: 30, memory: '256MiB' },
  quotazioniHandler
)
exports.quotazioniHandler = quotazioniHandler

exports.dettagliGiocatore = onRequest(
  { region: 'europe-west1', timeoutSeconds: 20, memory: '256MiB' },
  dettagliGiocatoreHandler
)
exports.dettagliGiocatoreHandler = dettagliGiocatoreHandler
