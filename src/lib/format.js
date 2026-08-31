export function formatRelativeTime(isoString) {
  if (!isoString) return null
  const then = new Date(isoString).getTime()
  if (Number.isNaN(then)) return null
  const diffMin = Math.round((Date.now() - then) / 60000)
  if (diffMin < 1) return 'aggiornato ora'
  if (diffMin === 1) return 'aggiornato 1 minuto fa'
  if (diffMin < 60) return `aggiornato ${diffMin} minuti fa`
  const diffH = Math.round(diffMin / 60)
  if (diffH === 1) return 'aggiornato 1 ora fa'
  if (diffH < 24) return `aggiornato ${diffH} ore fa`
  const diffD = Math.round(diffH / 24)
  return diffD === 1 ? 'aggiornato 1 giorno fa' : `aggiornato ${diffD} giorni fa`
}

export function formatRatio(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  return `${ratio.toFixed(1).replace('.', ',')}×`
}

// Medie con la virgola decimale italiana, come sul cartaceo.
export function formatAvg(value, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(decimals).replace('.', ',')
}

// "2025-26" → "25/26", per le etichette strette accanto ai numeri.
export function formatSeasonShort(season) {
  const m = String(season || '').match(/^(\d{4})-(\d{2})$/)
  return m ? `${m[1].slice(2)}/${m[2]}` : season || ''
}
