import { CLASSIC_ROLES } from './roles.js'

// --- Rosa e crediti ---

export function getMySquad(draftByPlayerId) {
  return Object.entries(draftByPlayerId || {})
    .filter(([, entry]) => entry.status === 'mine')
    .map(([id, entry]) => ({ id, ...entry }))
}

export function getCreditsSpent(mySquad) {
  return mySquad.reduce((sum, p) => sum + (Number(p.price) || 0), 0)
}

export function getCreditsRemaining(leagueConfig, mySquad) {
  return leagueConfig.totalCredits - getCreditsSpent(mySquad)
}

export function getSlotsFilledByRole(mySquad) {
  const filled = Object.fromEntries(CLASSIC_ROLES.map((r) => [r, 0]))
  for (const p of mySquad) {
    if (filled[p.roleClassic] != null) filled[p.roleClassic] += 1
  }
  return filled
}

export function getSlotsRemainingByRole(leagueConfig, filled) {
  const remaining = {}
  for (const role of CLASSIC_ROLES) {
    remaining[role] = Math.max(0, (leagueConfig.roles[role] || 0) - (filled[role] || 0))
  }
  return remaining
}

export function getTotalSlotsRemaining(remainingByRole) {
  return CLASSIC_ROLES.reduce((sum, r) => sum + (remainingByRole[r] || 0), 0)
}

// Quanto puoi spendere sul prossimo acquisto, qualunque ruolo — riservando almeno
// 1 credito per ciascuno degli altri slot ancora da riempire. È un valore unico
// e globale, non uno per ruolo: dipende solo dal totale di slot rimanenti.
export function computeMaxRecommendedBudget(creditsRemaining, totalSlotsRemaining) {
  if (totalSlotsRemaining <= 0) {
    return { value: 0, capped: false, complete: true }
  }
  const raw = creditsRemaining - (totalSlotsRemaining - 1)
  return { value: Math.max(0, raw), capped: raw < 0, complete: false }
}

// Soglie calibrate sui percentili reali del listone 2026/27 (527 calciatori:
// mediana 2.86, p75 3.54, p90 4.62, p95 5.79) — non soglie tonde a caso.
// className colora testo del tag, dot il pallino che lo precede.
export const CONVENIENCE_TIERS = [
  { id: 'occasione', label: 'Occasione', min: 5.5, className: 'text-campo', dot: 'bg-campo' },
  { id: 'buon-rapporto', label: 'Buon rapporto', min: 3.5, className: 'text-azzurro', dot: 'bg-azzurro' },
  { id: 'nella-norma', label: 'Nella norma', min: 1.0, className: 'text-muted', dot: 'bg-muted' },
  { id: 'sopravvalutato', label: 'Sopravvalutato', min: -Infinity, className: 'text-ocra', dot: 'bg-ocra' },
]

export function convenienceRatio(player) {
  const prezzo = player.quotazioneClassicAttuale
  const fvm = player.fvmClassic
  if (!prezzo || fvm == null) return null
  return fvm / prezzo
}

export function convenienceTier(player) {
  const ratio = convenienceRatio(player)
  if (ratio == null) return null
  return CONVENIENCE_TIERS.find((t) => ratio >= t.min) || null
}

// player.penaltyRank viene dalla pagina rigoristi di fantacalcio.it: 1 = rigorista
// titolare della squadra, 2 = secondo tiratore, 3+ = terza scelta (raramente tira,
// non mostrata come badge). null = non tra i rigoristi indicati.
// Sotto questa soglia una media dice poco: chi ha giocato 2-3 partite può avere
// una fantamedia altissima per un episodio fortunato, e non è confrontabile con
// chi ha retto un campionato intero. Non la nascondiamo, la segnaliamo.
export const MIN_PRESENZE_AFFIDABILI = 10

export function hasReliableAverage(stat) {
  return (stat?.presenze ?? 0) >= MIN_PRESENZE_AFFIDABILI
}

export function isPenaltyTaker(player) {
  return player.penaltyRank === 1 || player.penaltyRank === 2
}

// Medaglione "R" da schema tattico: pieno per il rigorista titolare,
// solo bordo per la seconda scelta.
export function penaltyRankBadge(player) {
  if (player.penaltyRank === 1) return { title: 'Rigorista', className: 'border-campo bg-campo text-paper' }
  if (player.penaltyRank === 2) return { title: '2º rigorista', className: 'border-campo text-campo' }
  return null
}

// --- Pool disponibile e suggerimenti ---

export function getAvailablePlayers(players, draftByPlayerId) {
  return players.filter((p) => !draftByPlayerId?.[p.id])
}

// --- Offerta consigliata sul singolo calciatore ---
//
// Il tetto globale dice quanto puoi spendere al massimo sul prossimo acquisto,
// qualunque esso sia; qui rispondiamo alla domanda che ci si fa davvero mentre
// il banditore rilancia: quanto vale la pena spendere per QUESTO.
//
// L'idea: guardare la rosa che realisticamente ti resta da comprare — per ogni
// ruolo scoperto i migliori disponibili, tanti quanti gli slot mancanti — e
// distribuire i crediti rimasti in proporzione alla QUOTAZIONE, non al FVM.
// Il FVM misura il valore fantacalcistico e sovrappesa gli attaccanti (Malen 414
// contro i 75 di Svilar), mentre i prezzi d'asta sono molto più compressi: usarlo
// per ripartire il budget consiglierebbe 9 crediti per un portiere che il mercato
// paga 18, cioè di non comprare mai portieri e difensori. La quotazione è già
// calibrata sul mercato, quindi fa da base; il FVM entra come correttivo di
// qualità, premiando chi rende più di quanto costa nel suo ruolo.
//
// Il risultato è una quota di budget, non una previsione di prezzo: dice quanto
// puoi spingerti senza sbilanciare il resto della rosa.

// Quanto si può spingere l'offerta sopra o sotto la quota base, in funzione di
// quanto il calciatore rende rispetto agli altri obiettivi.
const QUALITY_MIN = 0.75
const QUALITY_MAX = 1.5

function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
export function getTargetPool(availablePlayers, remainingByRole) {
  const pool = []
  for (const role of CLASSIC_ROLES) {
    const slots = remainingByRole[role] || 0
    if (slots > 0) pool.push(...getSuggestionsByRole(availablePlayers, role, slots))
  }
  return pool
}

// La stessa aritmetica vale per qualunque squadra, tua o avversaria: basta
// sapere quanti crediti le restano e quali slot deve ancora riempire.
export function computeBidForState({ player, players, draftByPlayerId, creditsRemaining, remainingByRole }) {
  const totalSlotsRemaining = getTotalSlotsRemaining(remainingByRole)
  const maxBudget = computeMaxRecommendedBudget(creditsRemaining, totalSlotsRemaining)

  if (remainingByRole[player.roleClassic] === 0) {
    return { value: null, reason: 'ruolo-completo', maxBudget }
  }
  if (totalSlotsRemaining <= 0 || creditsRemaining <= 0) {
    return { value: null, reason: 'rosa-completa', maxBudget }
  }

  const available = getAvailablePlayers(players, draftByPlayerId)
  const pool = getTargetPool(available, remainingByRole)
  // Il calciatore in esame entra nel conto anche se non è tra i migliori del suo
  // ruolo: stiamo valutando lui, non la rosa ideale.
  const valued = pool.some((p) => p.id === player.id) ? pool : [...pool, player]
  const totalQuot = valued.reduce((sum, p) => sum + (p.quotazioneClassicAttuale || 0), 0)
  const quot = player.quotazioneClassicAttuale || 0
  if (!totalQuot || !quot) {
    return { value: null, reason: 'senza-quotazione', maxBudget }
  }

  const share = quot / totalQuot

  // Correttivo di qualità: quanto rende rispetto agli obiettivi, non in assoluto.
  const poolMedian = median(valued.map((p) => convenienceRatio(p)))
  const qualityOf = (p) => {
    const r = convenienceRatio(p)
    if (r == null || !poolMedian) return 1
    return Math.min(QUALITY_MAX, Math.max(QUALITY_MIN, r / poolMedian))
  }

  // Senza normalizzare, i correttivi (in media sopra 1, perché gli obiettivi sono
  // i migliori del ruolo) gonfiano il totale: seguendo tutti i consigli si
  // spenderebbe più del budget. Dividendo per la media pesata dei correttivi, la
  // somma delle offerte sull'intera rosa obiettivo torna a coincidere con i
  // crediti disponibili — il consiglio resta sostenibile fino all'ultimo slot.
  const weighted = valued.reduce(
    (sum, p) => sum + ((p.quotazioneClassicAttuale || 0) / totalQuot) * qualityOf(p),
    0
  )
  const quality = qualityOf(player) / (weighted || 1)

  // Il tetto globale resta invalicabile: riserva un credito per ogni altro slot.
  const raw = Math.round(creditsRemaining * share * quality)
  const value = Math.max(1, Math.min(raw, maxBudget.value))

  return {
    value,
    share,
    quality,
    // Rispetto al prezzo di listino: sopra vuol dire "vale un rilancio".
    vsQuotazione: value - quot,
    reason: value >= maxBudget.value ? 'al-tetto' : 'ok',
    maxBudget,
  }
}

export function computeSuggestedBid({ player, players, draftByPlayerId, leagueConfig }) {
  const mySquad = getMySquad(draftByPlayerId)
  const creditsRemaining = getCreditsRemaining(leagueConfig, mySquad)
  const remainingByRole = getSlotsRemainingByRole(leagueConfig, getSlotsFilledByRole(mySquad))
  return computeBidForState({ player, players, draftByPlayerId, creditsRemaining, remainingByRole })
}

export function getSuggestionsByRole(availablePlayers, role, limit = 5) {
  return availablePlayers
    .filter((p) => p.roleClassic === role)
    .slice()
    .sort((a, b) => (b.fvmClassic ?? -Infinity) - (a.fvmClassic ?? -Infinity))
    .slice(0, limit)
}

// Dentro ogni ruolo si ordina per FVM assoluto (la valutazione complessiva del
// sito), non per indice di convenienza: un 1-credito con FVM basso ma ratio
// ottimo avrebbe impatto reale minimo sulla rosa. La convenienza resta un badge
// informativo accanto a ogni riga, non il criterio di ordinamento primario.
export function buildSuggestions({ players, draftByPlayerId, leagueConfig, limitPerRole = 5 }) {
  const mySquad = getMySquad(draftByPlayerId)
  const creditsRemaining = getCreditsRemaining(leagueConfig, mySquad)
  const filled = getSlotsFilledByRole(mySquad)
  const remainingByRole = getSlotsRemainingByRole(leagueConfig, filled)
  const totalSlotsRemaining = getTotalSlotsRemaining(remainingByRole)
  const maxBudget = computeMaxRecommendedBudget(creditsRemaining, totalSlotsRemaining)
  const availablePlayers = getAvailablePlayers(players, draftByPlayerId)

  const sections = CLASSIC_ROLES.filter((role) => remainingByRole[role] > 0).map((role) => ({
    role,
    slotsRemaining: remainingByRole[role],
    players: getSuggestionsByRole(availablePlayers, role, limitPerRole).map((p) => ({
      ...p,
      convenienceRatio: convenienceRatio(p),
      convenienceTier: convenienceTier(p),
    })),
  }))

  return { creditsRemaining, totalSlotsRemaining, maxBudget, sections }
}

// --- Avversari ---
//
// Ogni altra squadra della lega parte con gli stessi crediti e gli stessi slot:
// registrando chi ha preso cosa e a quanto, la stessa aritmetica della tua rosa
// dice quanto può ancora spendere ciascuno. È la differenza tra "ha 300 crediti"
// e "può metterne al massimo 281 su un giocatore solo".

export function getOpponents(leagueConfig) {
  return Array.isArray(leagueConfig?.opponents) ? leagueConfig.opponents : []
}

export function getTakenEntries(draftByPlayerId) {
  return Object.entries(draftByPlayerId || {})
    .filter(([, entry]) => entry.status === 'taken')
    .map(([id, entry]) => ({ id, ...entry }))
}

// Acquisti segnati "a un altro" senza dire a chi (o a una squadra poi rimossa):
// non entrano in nessun conto, e finché restano i tetti degli altri sono
// sovrastimati.
export function getUnassignedTaken(draftByPlayerId, leagueConfig) {
  const ids = new Set(getOpponents(leagueConfig).map((o) => o.id))
  return getTakenEntries(draftByPlayerId).filter((e) => !e.ownerId || !ids.has(e.ownerId))
}

export function computeOpponentStates(leagueConfig, draftByPlayerId) {
  const taken = getTakenEntries(draftByPlayerId)
  return getOpponents(leagueConfig).map((opponent) => {
    const squad = taken.filter((e) => e.ownerId === opponent.id)
    const spent = getCreditsSpent(squad)
    const remaining = leagueConfig.totalCredits - spent
    const filled = getSlotsFilledByRole(squad)
    const remainingByRole = getSlotsRemainingByRole(leagueConfig, filled)
    const totalSlotsRemaining = getTotalSlotsRemaining(remainingByRole)
    const maxBudget = computeMaxRecommendedBudget(remaining, totalSlotsRemaining)
    // Acquisti registrati senza prezzo: contano negli slot ma non nei crediti,
    // quindi il residuo di questa squadra è per eccesso.
    const withoutPrice = squad.filter((e) => e.price == null).length
    return {
      ...opponent,
      squad,
      spent,
      remaining,
      filled,
      remainingByRole,
      totalSlotsRemaining,
      maxBudget,
      withoutPrice,
    }
  })
}

// Chi può ancora rilanciare su QUESTO calciatore: serve uno slot libero nel suo
// ruolo e almeno un credito oltre a quelli da riservare agli altri slot.
// maxBid è il tetto invalicabile; estimate è quanto quella squadra spenderebbe
// seguendo lo stesso criterio dell'offerta consigliata — la cifra realistica,
// non quella teorica.
export function computeRivalThreat({ player, players, draftByPlayerId, leagueConfig }) {
  const role = player.roleClassic
  const contenders = []
  const outOfRace = []
  for (const state of computeOpponentStates(leagueConfig, draftByPlayerId)) {
    if ((state.remainingByRole[role] || 0) <= 0) {
      outOfRace.push({ ...state, why: 'ruolo-completo' })
      continue
    }
    if (state.maxBudget.value <= 0) {
      outOfRace.push({ ...state, why: 'senza-crediti' })
      continue
    }
    const estimate = computeBidForState({
      player,
      players,
      draftByPlayerId,
      creditsRemaining: state.remaining,
      remainingByRole: state.remainingByRole,
    })
    contenders.push({ ...state, maxBid: state.maxBudget.value, estimate: estimate.value })
  }
  contenders.sort((a, b) => b.maxBid - a.maxBid || (b.estimate ?? 0) - (a.estimate ?? 0))
  return {
    contenders,
    outOfRace,
    topThreat: contenders[0] || null,
    unassigned: getUnassignedTaken(draftByPlayerId, leagueConfig),
  }
}

// Quanto serve per essere certi di prenderlo: un credito sopra il tetto del
// più ricco tra chi può ancora rilanciare — se il tuo tetto lo permette.
export function computeAnticipation({ player, players, draftByPlayerId, leagueConfig }) {
  const bid = computeSuggestedBid({ player, players, draftByPlayerId, leagueConfig })
  const threat = computeRivalThreat({ player, players, draftByPlayerId, leagueConfig })
  const myMax = bid.maxBudget.value
  const rivalMax = threat.topThreat?.maxBid ?? 0
  const needed = rivalMax + 1
  return {
    bid,
    threat,
    rivalMax,
    needed,
    feasible: needed <= myMax,
    // L'offerta consigliata basta già: nessuno può arrivarci.
    covered: bid.value != null && bid.value >= needed,
  }
}
