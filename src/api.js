async function getJson(url, fallbackMessage) {
  const res = await fetch(url)
  if (!res.ok) {
    let message = fallbackMessage
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* risposta non JSON: uso il messaggio di default */
    }
    throw new Error(message)
  }
  return res.json()
}

export function fetchQuotazioni() {
  return getJson('/api/quotazioni', 'Impossibile recuperare le quotazioni.')
}

export function fetchPlayerDetails(player) {
  const params = new URLSearchParams({
    id: player.id,
    url: player.profileUrl,
    name: player.name,
    team: player.team,
  })
  return getJson(`/api/dettagli-giocatore?${params}`, 'Impossibile recuperare i dettagli del calciatore.')
}
