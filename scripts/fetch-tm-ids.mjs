/*
 * Costruisce la mappa id fantacalcio.it → id Transfermarkt, da eseguire DAL MAC.
 *
 * Perché non nella Cloud Function: la ricerca di Transfermarkt
 * (www.transfermarkt.it) risponde agli IP dei datacenter Google con una pagina
 * di protezione anti-bot vuota — verificato, 202 senza righe. Dal Mac risponde
 * normalmente. L'API `tmapi.transfermarkt.technology`, che espone infortuni e
 * statistiche, invece risponde a tutti: una volta noto l'id, la function se la
 * cava da sola.
 *
 * L'id di un calciatore non cambia mai, quindi la mappa si rigenera solo quando
 * entrano volti nuovi nel listone (mercato di gennaio). Riprende da dove si era
 * fermata: rilanciarlo dopo un'interruzione non ripete il lavoro già fatto.
 *
 *   node scripts/fetch-tm-ids.mjs [--force] [--limit N]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'functions/data/transfermarkt-ids.json')
const QUOTAZIONI_API = 'https://fantacalcio-asta-tb.web.app/api/quotazioni'
const SEARCH_URL = 'https://www.transfermarkt.it/schnellsuche/ergebnis/schnellsuche'
const TM_API = 'https://tmapi.transfermarkt.technology'
const THROTTLE_MS = 1200

// Le stesse parole chiave della function: si accetta un risultato solo se la
// squadra attuale su Transfermarkt corrisponde, mai un omonimo.
const TEAM_KEYWORDS = {
  ATA: 'Atalanta', BOL: 'Bologna', CAG: 'Cagliari', COM: 'Como', FIO: 'Fiorentina',
  FRO: 'Frosinone', GEN: 'Genoa', INT: 'Inter', JUV: 'Juventus', LAZ: 'Lazio',
  LEC: 'Lecce', MIL: 'Milan', MON: 'Monza', NAP: 'Napoli', PAR: 'Parma',
  ROM: 'Roma', SAS: 'Sassuolo', TOR: 'Torino', UDI: 'Udinese', VEN: 'Venezia',
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// fantacalcio.it disambigua gli omonimi con le iniziali del nome in coda
// ("Martinez L.", "Esposito Se.", "Ederson D.S."): Transfermarkt non conosce
// questa convenzione e con quelle sigle non trova nulla.
const cleanSearchName = (name) =>
  String(name || '')
    .replace(/(\s+[A-Z][a-zA-Z]?\.)+$/, '')
    .trim()
const decode = (s) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')

// Nella pagina dei risultati ogni calciatore occupa DUE righe di tabella: la
// prima col ritratto e il nome, la seconda con la squadra attuale. Invece di
// ragionare per <tr>, si taglia l'HTML da un link-profilo al successivo: dentro
// quel pezzo c'è la squadra di quel calciatore e nessun'altra. L'attributo
// title compare sia prima sia dopo href, quindi si cercano entrambi gli ordini.
const CLUB_TITLE_RES = [
  /<a[^>]*\/startseite\/verein\/\d+"[^>]*title="([^"]*)"/g,
  /<a[^>]*title="([^"]*)"[^>]*href="[^"]*\/startseite\/verein\/\d+"/g,
]

function findMatch(html, teamKeyword) {
  const anchors = [...html.matchAll(/<a[^>]*\/profil\/spieler\/(\d+)"/g)]
  const keyword = teamKeyword.toLowerCase()
  for (let i = 0; i < anchors.length; i += 1) {
    const start = anchors[i].index
    const end = i + 1 < anchors.length ? anchors[i + 1].index : html.length
    const chunk = html.slice(start, end)
    const clubs = CLUB_TITLE_RES.flatMap((re) => [...chunk.matchAll(re)].map((m) => decode(m[1]))).filter(Boolean)
    if (!clubs.some((c) => c.toLowerCase().includes(keyword))) continue
    const nameMatch = chunk.match(/<a[^>]*title="([^"]*)"[^>]*\/profil\/spieler\/\d+"/) ||
      chunk.match(/\/profil\/spieler\/\d+"[^>]*>([^<]+)</)
    return { tmId: anchors[i][1], tmName: nameMatch ? decode(nameMatch[1]).trim() : null, club: clubs[0] }
  }
  return { rowsSeen: anchors.length }
}

// --- Ripescaggio dalle rose ---
//
// La ricerca rapida di Transfermarkt restituisce dieci risultati ordinati per
// notorietà: i panchinari con un cognome comune non ci arrivano mai (cercando
// "Patric" escono Patrick Vieira e Patrice Evra, non il difensore della Lazio).
// Per loro si parte dalla squadra: l'API dà la rosa completa di un club, e fra
// quei trenta nomi il cognome giusto si riconosce senza ambiguità.

const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function tmApi(path) {
  const res = await fetch(`${TM_API}${path}`, {
    headers: { Accept: 'application/json', Referer: 'https://www.transfermarkt.it/' },
  })
  if (!res.ok) throw new Error(`tmapi ${path}: HTTP ${res.status}`)
  const body = await res.json()
  if (!body?.success) throw new Error(`tmapi ${path}: risposta senza successo`)
  return body.data
}

// Il club di un calciatore già mappato identifica la squadra su Transfermarkt,
// senza doverne cercare il nome.
async function clubIdFromKnownPlayer(tmId) {
  const data = await tmApi(`/player/${tmId}`)
  const assignments = data?.clubAssignments || []
  const current = assignments.find((a) => a.type === 'current') || assignments[0]
  return current?.clubId || null
}

// Ruolo del listone a partire dal gruppo di Transfermarkt, per distinguere due
// omonimi della stessa squadra (Josep e Lautaro Martínez all'Inter).
const ROLE_BY_GROUP = { Goalkeeper: 'P', Defender: 'D', Midfielder: 'C', Striker: 'A', Forward: 'A' }

async function describePlayers(tmIds) {
  const out = []
  for (const tmId of tmIds) {
    try {
      const data = await tmApi(`/player/${tmId}`)
      const name = data?.name || ''
      out.push({
        tmId,
        tmName: name,
        words: normalize(name).split(' ').filter(Boolean),
        role: ROLE_BY_GROUP[data?.attributes?.positionGroupName] || null,
      })
    } catch {
      /* un profilo mancante non deve fermare la squadra */
    }
    await sleep(250)
  }
  return out
}

// La ricerca per nome può assegnare lo stesso calciatore di Transfermarkt a due
// voci del listone: succede con gli omonimi di squadra, dove il listone scrive
// "Martinez L." e "Martinez Jo." e la ricerca restituisce sempre il più noto.
// Qui si riparte dalla rosa e si assegna solo ciò che è certo: le iniziali del
// nome proprio, o in mancanza il ruolo. Quello che resta ambiguo si scarta —
// mostrare gli infortuni di Lautaro sulla scheda del portiere sarebbe peggio
// che non mostrarne nessuno.
async function resolveDuplicates(map, players) {
  const claims = new Map()
  for (const [fcId, entry] of Object.entries(map.byId)) {
    if (!claims.has(entry.tmId)) claims.set(entry.tmId, [])
    claims.get(entry.tmId).push(fcId)
  }
  const conflicted = [...claims.values()].filter((ids) => ids.length > 1)
  if (!conflicted.length) return 0

  const roleById = new Map(players.map((p) => [p.id, p.roleClassic]))
  let fixed = 0
  for (const fcIds of conflicted) {
    const group = fcIds.map((fcId) => ({ fcId, ...map.byId[fcId], role: roleById.get(fcId) || null }))
    console.log(`\n  Conflitto su ${group[0].tmId}: ${group.map((g) => `${g.name} (${g.role})`).join(' · ')}`)
    for (const g of group) delete map.byId[g.fcId]

    const team = group[0].team
    const known = Object.values(map.byId).find((e) => e.team === team)
    if (!known) continue
    let candidates = []
    try {
      const clubId = await clubIdFromKnownPlayer(known.tmId)
      const squad = (await tmApi(`/club/${clubId}/squad`))?.squad?.map((p) => p.playerId) || []
      const surname = normalize(cleanSearchName(group[0].name)).split(' ').filter(Boolean)
      const described = await describePlayers(squad)
      candidates = described.filter((c) => surname.every((w) => c.words.includes(w)))
    } catch (err) {
      console.log(`    rosa ${team} non recuperata: ${err.message}`)
      continue
    }

    const taken = new Set()
    // Prima le iniziali: "Martinez Jo." è Josep, non Lautaro.
    for (const g of group) {
      const initials = normalize(String(g.name).match(/([A-Z][a-zA-Z]?\.)+$/)?.[0] || '')
      if (!initials) continue
      const hits = candidates.filter(
        (c) => !taken.has(c.tmId) && c.words.some((w) => w.startsWith(initials) && !normalize(cleanSearchName(g.name)).split(' ').includes(w))
      )
      if (hits.length === 1) {
        map.byId[g.fcId] = { tmId: hits[0].tmId, tmName: hits[0].tmName, name: g.name, team: g.team }
        taken.add(hits[0].tmId)
        fixed += 1
        console.log(`    + ${g.name} → ${hits[0].tmName} (iniziali)`)
      }
    }
    // Poi il ruolo, per chi nel listone non ha iniziali.
    for (const g of group) {
      if (map.byId[g.fcId]) continue
      const hits = candidates.filter((c) => !taken.has(c.tmId) && c.role && c.role === g.role)
      if (hits.length === 1) {
        map.byId[g.fcId] = { tmId: hits[0].tmId, tmName: hits[0].tmName, name: g.name, team: g.team }
        taken.add(hits[0].tmId)
        fixed += 1
        console.log(`    + ${g.name} → ${hits[0].tmName} (ruolo ${g.role})`)
      } else {
        console.log(`    ? ${g.name} resta senza collegamento (${hits.length} candidati)`)
      }
    }
  }
  return fixed
}

async function recoverFromSquads(missing, map) {
  const byTeam = new Map()
  for (const player of missing) {
    if (!byTeam.has(player.team)) byTeam.set(player.team, [])
    byTeam.get(player.team).push(player)
  }
  let recovered = 0

  for (const [team, players] of byTeam) {
    const known = Object.values(map.byId).find((e) => e.team === team)
    if (!known) {
      console.log(`  · ${team}: nessun calciatore già mappato, salto`)
      continue
    }
    let squadIds
    try {
      const clubId = await clubIdFromKnownPlayer(known.tmId)
      if (!clubId) throw new Error('club non determinato')
      squadIds = (await tmApi(`/club/${clubId}/squad`))?.squad?.map((p) => p.playerId) || []
    } catch (err) {
      console.log(`  · ${team}: rosa non recuperata (${err.message})`)
      continue
    }
    // Restano da identificare solo i tesserati non ancora in mappa.
    const mapped = new Set(Object.values(map.byId).map((e) => e.tmId))
    const unknown = squadIds.filter((id) => !mapped.has(id))
    const names = await describePlayers(unknown)

    for (const player of players) {
      const wanted = normalize(cleanSearchName(player.name)).split(' ').filter(Boolean)
      if (!wanted.length) continue
      // Il listone dà il cognome, Transfermarkt il nome completo: si accetta
      // solo se TUTTE le parole del listone compaiono, e un candidato solo.
      const hits = names.filter((n) => wanted.every((w) => n.words.includes(w)))
      if (hits.length === 1) {
        map.byId[player.id] = { tmId: hits[0].tmId, tmName: hits[0].tmName, name: player.name, team: player.team }
        recovered += 1
        console.log(`  + ${player.name} (${team}) → ${hits[0].tmName}`)
      } else {
        console.log(`  ? ${player.name} (${team}) — ${hits.length} candidati nella rosa`)
      }
    }
  }
  return recovered
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity

const { players } = await fetch(QUOTAZIONI_API).then((r) => r.json())
console.log(`Listone: ${players.length} calciatori`)

const map = !force && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { generatedAt: null, byId: {} }
map.byId ||= {}

// I ceduti fuori dalla Serie A non servono: non si comprano più.
const todo = players.filter((p) => !p.ceduto && !map.byId[p.id] && TEAM_KEYWORDS[p.team]).slice(0, limit)
console.log(`Da cercare: ${todo.length} (già in mappa: ${Object.keys(map.byId).length})`)

let done = 0
let notFound = 0
for (const player of todo) {
  // Alcuni nomi del listone sono troncati o accentati diversamente: se la
  // ricerca esatta non dà nulla si riprova con la sola prima parola, che è
  // quasi sempre il cognome.
  const queries = [cleanSearchName(player.name)]
  const firstWord = queries[0].split(/\s+/)[0]
  if (firstWord && firstWord !== queries[0]) queries.push(firstWord)

  let match = null
  for (const query of queries) {
    try {
      const res = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}`, { headers: HEADERS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      match = findMatch(await res.text(), TEAM_KEYWORDS[player.team])
      if (match.tmId) break
    } catch (err) {
      console.log(`  ! ${player.name}: ${err.message}`)
    }
    if (queries.length > 1) await sleep(THROTTLE_MS)
  }
  if (match?.tmId) {
    map.byId[player.id] = { tmId: match.tmId, tmName: match.tmName, name: player.name, team: player.team }
    done += 1
  } else {
    notFound += 1
    console.log(`  ? ${player.name} (${player.team}) — ${match?.rowsSeen ?? 0} risultati, nessuno della squadra`)
  }
  if ((done + notFound) % 25 === 0) {
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify({ ...map, generatedAt: new Date().toISOString() }, null, 0))
    console.log(`  … ${done + notFound}/${todo.length} (trovati ${done})`)
  }
  await sleep(THROTTLE_MS)
}

const stillMissing = todo.filter((p) => !map.byId[p.id])
if (stillMissing.length) {
  console.log(`\nRipescaggio dalle rose per ${stillMissing.length} calciatori…`)
  const recovered = await recoverFromSquads(stillMissing, map)
  notFound -= recovered
}

await resolveDuplicates(map, players)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ ...map, generatedAt: new Date().toISOString() }, null, 0))
console.log(`\nFatto: ${Object.keys(map.byId).length} id in mappa, ${notFound} non trovati in questa passata.`)
console.log(OUT)
