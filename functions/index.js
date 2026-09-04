/*
 * Cloud Functions per l'assistente asta fantacalcio.
 *
 * `quotazioni`: recupera le pagine pubbliche di fantacalcio.it (nessun login
 * richiesto) e le trasforma in un elenco JSON di calciatori: quotazioni (ruoli,
 * prezzi, FVM Classic e Mantra), rigoristi (gerarchia dei tiratori di rigore per
 * squadra), statistiche dell'ULTIMA STAGIONE CONCLUSA (presenze, medie, gol,
 * assist, cartellini), indisponibili, e le rose aggiornate col mercato per
 * marcare chi è stato ceduto fuori dalla Serie A, unite per id calciatore.
 * Chiamata dal bottone "Aggiorna quotazioni".
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
const INDISPONIBILI_URL = 'https://www.fantacalcio.it/indisponibili-serie-a'
const PROBABILI_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a'
const SQUADRE_URL = 'https://www.fantacalcio.it/serie-a/squadre'
// Sotto questa soglia la pagina di una rosa è sospetta (restyling o errore) e
// non la usiamo per giudicare nessuno: meglio un ceduto in più nel listone che
// una squadra intera marcata per sbaglio.
const MIN_EXPECTED_SQUAD_SIZE = 15
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

// Transfermarkt serve contenuto diverso a chi non somiglia a un browser: senza
// Accept/Accept-Language da navigatore la pagina di ricerca torna senza risultati.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
}

async function fetchHtml(url, headers = BROWSER_HEADERS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers })
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

// Lo slug della squadra sta nell'URL del profilo (".../serie-a/squadre/milan/pulisic/2423").
function extractTeamSlug(profileUrl) {
  const match = String(profileUrl || '').match(/\/serie-a\/squadre\/([^/]+)\//)
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

// --- Rose aggiornate col mercato ---
//
// Il listone delle quotazioni tiene dentro chi è stato ceduto fuori dalla
// Serie A fino al successivo aggiornamento del sito, che può arrivare giorni
// dopo la chiusura del mercato: in piena asta ci si ritrova a contrattare
// calciatori che non esistono più. La pagina della rosa di ogni squadra invece
// è già allineata, e linka il profilo di ogni calciatore in organico con lo
// stesso id numerico del listone: chi non compare in nessuna rosa è ceduto.

function parseSquadIds(html, slug) {
  const $ = cheerio.load(html)
  const ids = new Set()
  const prefix = `/serie-a/squadre/${slug}/`
  $(`a[href*="${prefix}"]`).each((_, el) => {
    const href = $(el).attr('href') || ''
    const rest = href.slice(href.indexOf(prefix) + prefix.length)
    // Solo i profili ("<nome>/<id>"), non le pagine di squadra o le notizie.
    if (!/^[^/]+\/\d+\/?$/.test(rest)) return
    const id = extractPlayerId(href)
    if (id) ids.add(id)
  })
  return ids
}

// Una richiesta per squadra, in parallelo. Ritorna dove gioca oggi ogni id
// (slug della rosa che lo linka) e quali rose sono state lette con successo:
// i calciatori di una rosa non letta non vengono giudicati.
async function fetchSquads(players) {
  const slugs = new Set()
  for (const p of players) {
    const slug = extractTeamSlug(p.profileUrl)
    if (slug) slugs.add(slug)
  }
  const slugById = new Map()
  const loadedSlugs = new Set()
  const warnings = []
  await Promise.all(
    [...slugs].map(async (slug) => {
      try {
        const ids = parseSquadIds(await fetchHtml(`${SQUADRE_URL}/${slug}`), slug)
        if (ids.size < MIN_EXPECTED_SQUAD_SIZE) {
          warnings.push(`Rosa ${slug}: trovati solo ${ids.size} calciatori, pagina ignorata`)
          return
        }
        loadedSlugs.add(slug)
        for (const id of ids) slugById.set(id, slug)
      } catch (err) {
        warnings.push(`Rosa ${slug} non recuperata: ${err.message}`)
      }
    })
  )
  return { slugById, loadedSlugs, warnings }
}

// Marca `ceduto` chi non è più in nessuna rosa e aggiorna la squadra di chi è
// passato a un altro club di Serie A (il listone mostra ancora la vecchia).
function applySquads(players, { slugById, loadedSlugs }) {
  const codeBySlug = new Map()
  for (const p of players) {
    const slug = extractTeamSlug(p.profileUrl)
    if (slug && p.team && !codeBySlug.has(slug)) codeBySlug.set(slug, p.team)
  }
  let ceduti = 0
  for (const p of players) {
    const slug = extractTeamSlug(p.profileUrl)
    if (!slug || !loadedSlugs.has(slug)) continue
    const currentSlug = slugById.get(p.id)
    if (!currentSlug) {
      p.ceduto = true
      ceduti += 1
    } else if (currentSlug !== slug && codeBySlug.get(currentSlug)) {
      p.team = codeBySlug.get(currentSlug)
    }
  }
  return ceduti
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

// Chi è fermo ADESSO: infortunati, squalificati e diffidati, una card per squadra
// con le voci in `strong.item-name` e la spiegazione in prosa accanto.
//
// La nota è testo editoriale ("out per una lesione..., rientro previsto a
// ottobre"): non provo a ricavarne date o durate, che sarebbe interpretazione
// fragile — la riporto com'è, perché è già scritta per essere letta al volo.
// Il collegamento col listone è per nome + squadra: entrambe le pagine vengono
// da fantacalcio.it e usano la stessa convenzione ("Sulemana K.").
const STATUS_BY_LABEL = [
  [/infortunat/i, 'infortunato'],
  [/squalificat/i, 'squalificato'],
  [/diffidat/i, 'diffidato'],
]

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function statusKey(teamName, playerName) {
  return `${normalizeName(teamName)}|${normalizeName(playerName)}`
}

function parseIndisponibili(html, minExpectedTeams) {
  const $ = cheerio.load(html)
  const teamCards = $('.team-card')
  const warnings = []
  const statusByKey = new Map()

  if (teamCards.length < minExpectedTeams) {
    warnings.push(
      `Pagina indisponibili: trovate solo ${teamCards.length} squadre (attese almeno ${minExpectedTeams}) — stato dei calciatori ignorato`
    )
    return { statusByKey, warnings }
  }

  teamCards.each((_, teamEl) => {
    const $team = $(teamEl)
    const teamName = $team.find('.team-name').first().text().trim()
    if (!teamName) return

    $team.find('.col').each((__, colEl) => {
      const $col = $(colEl)
      const labelText = $col.find('header').first().text()
      const found = STATUS_BY_LABEL.find(([re]) => re.test(labelText))
      if (!found) return
      const tipo = found[1]

      $col.find('li').each((___, li) => {
        const $li = $(li)
        const playerName = $li.find('.item-name').first().text().trim()
        if (!playerName) return
        const nota = $li.find('.item-description').first().text().replace(/\s+/g, ' ').trim()
        // Un calciatore può comparire in più categorie: tengo la prima, che è
        // la più penalizzante nell'ordine in cui il sito le presenta.
        const key = statusKey(teamName, playerName)
        if (!statusByKey.has(key)) statusByKey.set(key, { tipo, nota: nota || null })
      })
    })
  })

  return { statusByKey, warnings }
}

// --- Probabili formazioni: il cuore del companion settimanale ---
//
// Una card per squadra con modulo, XI titolare (`ul.player-list.starters`) e
// panchina (`ul.player-list.reserves`); ogni voce porta il link al profilo — lo
// stesso id stabile del listone, quindi il join è per ID, non per nome — e la
// percentuale di titolarità della redazione. Gli orari delle partite nella
// pagina sono placeholder riempiti via JavaScript: non li estraiamo apposta,
// meglio nessun orario che un orario finto.
function parseProbabili(html, minExpectedTeams) {
  const $ = cheerio.load(html)
  const teamCards = $('.team-card')
  const warnings = []

  if (teamCards.length < minExpectedTeams) {
    throw new UpstreamError(
      `Probabili formazioni: trovate solo ${teamCards.length} squadre (attese almeno ${minExpectedTeams}) — probabile cambio di struttura della pagina`
    )
  }

  const teams = []
  teamCards.each((_, teamEl) => {
    const $team = $(teamEl)
    const name = $team.find('.team-name').first().text().trim()
    if (!name) return
    const formation = $team.find('.team-formation').first().text().trim() || null

    const readList = (selector) => {
      const out = []
      $team.find(selector).find('li.player-item').each((__, li) => {
        const $li = $(li)
        const link = $li.find('a.player-name').first()
        const id = extractPlayerId(link.attr('href'))
        const playerName = link.find('span').first().text().trim() || link.text().trim()
        if (!id || !playerName) {
          warnings.push(`Probabili ${name}: voce scartata ("${playerName}")`)
          return
        }
        const pct = parseNumber($li.find('.progress-value').first().text().replace('%', ''))
        out.push({ id, name: playerName, role: ($li.find('.role').attr('data-value') || '').toUpperCase() || null, pct })
      })
      return out
    }

    teams.push({
      team: name,
      formation,
      starters: readList('ul.player-list.starters'),
      reserves: readList('ul.player-list.reserves'),
    })
  })

  const lastUpdate = $('.last-update').first().text().replace(/\s+/g, ' ').trim() || null
  return { teams, lastUpdate, warnings }
}

async function probabiliHandler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo non consentito.' })
    return
  }
  try {
    const html = await fetchHtml(PROBABILI_URL)
    const { teams, lastUpdate, warnings } = parseProbabili(html, MIN_EXPECTED_TEAMS.value())
    // Indice piatto per il join lato client: id -> titolarità.
    const byPlayerId = {}
    for (const t of teams) {
      for (const p of t.starters) byPlayerId[p.id] = { team: t.team, starter: true, pct: p.pct }
      for (const p of t.reserves) if (!byPlayerId[p.id]) byPlayerId[p.id] = { team: t.team, starter: false, pct: p.pct }
    }
    res.status(200).json({
      teams,
      byPlayerId,
      lastUpdate,
      fetchedAt: new Date().toISOString(),
      warnings: warnings.length ? warnings.slice(0, 20) : undefined,
    })
  } catch (err) {
    console.error('Errore recupero probabili formazioni:', err)
    const status = Number.isInteger(err.status) ? err.status : 500
    res.status(status).json({
      error: 'Impossibile recuperare le probabili formazioni in questo momento. Riprova più tardi.',
    })
  }
}

async function quotazioniHandler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Metodo non consentito.' })
    return
  }
  try {
    const season = previousSeasonLabel()
    const [quotazioniHtml, rigoristiHtml, statisticheHtml, indisponibiliHtml] = await Promise.all([
      fetchHtml(QUOTAZIONI_URL),
      fetchHtml(RIGORISTI_URL).catch((err) => {
        console.error('Errore recupero rigoristi (non bloccante):', err)
        return null
      }),
      fetchHtml(`${STATISTICHE_URL}/${season}`).catch((err) => {
        console.error(`Errore recupero statistiche ${season} (non bloccante):`, err)
        return null
      }),
      fetchHtml(INDISPONIBILI_URL).catch((err) => {
        console.error('Errore recupero indisponibili (non bloccante):', err)
        return null
      }),
    ])

    const { players, warnings } = parsePlayers(quotazioniHtml, MIN_EXPECTED_ROWS.value())

    // Prima di tutto il resto: la squadra corretta serve anche al join degli
    // indisponibili, che è per nome e squadra.
    const squads = await fetchSquads(players)
    const ceduti = applySquads(players, squads)

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

    let statusByKey = new Map()
    let statusWarnings = []
    if (indisponibiliHtml) {
      const parsed = parseIndisponibili(indisponibiliHtml, MIN_EXPECTED_TEAMS.value())
      statusByKey = parsed.statusByKey
      statusWarnings = parsed.warnings
    } else {
      statusWarnings = [
        'Impossibile recuperare infortunati e squalificati: il resto dei dati è comunque disponibile.',
      ]
    }
    // Le due pagine chiamano le squadre in modo diverso (sigla contro nome
    // esteso): la chiave dello stato si ricostruisce dal nome completo.
    const teamNameByCode = {}
    for (const [code, keyword] of Object.entries(TEAM_KEYWORDS)) teamNameByCode[code] = keyword

    for (const player of players) {
      player.penaltyRank = penaltyRankById.get(player.id) ?? null
      // Assente per chi non ha giocato in Serie A quella stagione (neopromossi,
      // arrivi dall'estero, giovani): il frontend lo mostra come "esordiente".
      player.prevSeason = statsById.get(player.id) ?? null
      const teamName = teamNameByCode[player.team]
      player.status = teamName ? (statusByKey.get(statusKey(teamName, player.name)) ?? null) : null
    }

    const allWarnings = [...warnings, ...squads.warnings, ...rigoristiWarnings, ...statsWarnings, ...statusWarnings]
    res.status(200).json({
      players,
      count: players.length,
      ceduti,
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

// Parola chiave distintiva per ciascuna squadra, usata per riconoscere la stessa
// squadra scritta in modi diversi: Transfermarkt usa il nome ufficiale per esteso
// ("ACF Fiorentina", "AS Roma", "AC Milan"), le pagine fantacalcio.it il nome
// breve ("Fiorentina"), il listone la sigla ("FIO"). Si verifica che il nome
// contenga la parola chiave, non l'uguaglianza.
const TEAM_KEYWORDS = {
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
  const teamKeyword = TEAM_KEYWORDS[teamCode]
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
  // Nessuna riga con la squadra giusta: meglio niente che un omonimo sbagliato.
  // Il conteggio righe distingue "cercato e non trovato" da "pagina vuota o
  // diversa da quella attesa", che vuol dire che la ricerca non ha risposto.
  return { notFound: true, rowsSeen: rows.length, query }
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
  if (!match || match.notFound) {
    console.log('Transfermarkt: nessun match', JSON.stringify({ name, teamCode, ...(match || {}) }))
    return { found: false, rowsSeen: match?.rowsSeen ?? null }
  }
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

exports.probabili = onRequest(
  { region: 'europe-west1', timeoutSeconds: 30, memory: '256MiB' },
  probabiliHandler
)
exports.probabiliHandler = probabiliHandler

exports.dettagliGiocatore = onRequest(
  { region: 'europe-west1', timeoutSeconds: 20, memory: '256MiB' },
  dettagliGiocatoreHandler
)
exports.dettagliGiocatoreHandler = dettagliGiocatoreHandler
