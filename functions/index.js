/*
 * Cloud Functions per l'assistente asta fantacalcio.
 *
 * `quotazioni`: recupera due pagine pubbliche di fantacalcio.it (nessun login
 * richiesto) e le trasforma in un elenco JSON di calciatori: quotazioni (ruoli,
 * prezzi, FVM Classic e Mantra) e rigoristi (gerarchia dei tiratori di rigore per
 * squadra), unite per id calciatore. Chiamata dal bottone "Aggiorna quotazioni".
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
const FETCH_TIMEOUT_MS = 20_000
const MAX_INVALID_ROW_RATIO = 0.1
const CLASSIC_ROLE_MAP = { p: 'P', d: 'D', c: 'C', a: 'A' }

// Soglie minime di sanità: sotto queste soglie trattiamo la risposta come
// sospetta (probabile restyling del sito) invece di restituire dati incompleti.
// Ritarabili senza redeploy via functions/.env.
const MIN_EXPECTED_ROWS = defineInt('MIN_EXPECTED_ROWS', { default: 400 }) // oggi ~527 calciatori
const MIN_EXPECTED_TEAMS = defineInt('MIN_EXPECTED_TEAMS', { default: 15 }) // 20 squadre Serie A

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

function extractPlayerId(href) {
  if (!href) return null
  const match = href.match(/\/(\d+)\/?$/)
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

async function quotazioniHandler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo non consentito.' })
    return
  }
  try {
    const [quotazioniHtml, rigoristiHtml] = await Promise.all([
      fetchHtml(QUOTAZIONI_URL),
      fetchHtml(RIGORISTI_URL).catch((err) => {
        console.error('Errore recupero rigoristi (non bloccante):', err)
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
    for (const player of players) {
      player.penaltyRank = penaltyRankById.get(player.id) ?? null
    }

    const allWarnings = [...warnings, ...rigoristiWarnings]
    res.status(200).json({
      players,
      count: players.length,
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
