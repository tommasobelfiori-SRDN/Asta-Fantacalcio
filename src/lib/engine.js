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
