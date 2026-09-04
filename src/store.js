import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchQuotazioni as apiFetchQuotazioni, fetchPlayerDetails as apiFetchPlayerDetails } from './api.js'
import { DEFAULT_LEAGUE_CONFIG } from './lib/roles.js'

const STORAGE_KEY = 'fantacalcio-asta-state'
const STORAGE_VERSION = 1

const DEFAULT_FILTERS = {
  search: '',
  role: 'all', // 'all' | 'P' | 'D' | 'C' | 'A'
  onlyAvailable: true,
  onlyPenaltyTakers: false,
  hideUnavailable: false,
  sortBy: 'fvm', // 'fvm' | 'prezzo' | 'nome'
}

function snapshotFromPlayer(player) {
  return { name: player.name, team: player.team, roleClassic: player.roleClassic }
}

// Il config salvato da versioni precedenti non ha la lista avversari: si
// completa con i default invece di rompersi al primo accesso.
export function normalizeLeagueConfig(config) {
  return {
    ...DEFAULT_LEAGUE_CONFIG,
    ...(config || {}),
    roles: { ...DEFAULT_LEAGUE_CONFIG.roles, ...(config?.roles || {}) },
    opponents: Array.isArray(config?.opponents) ? config.opponents : [],
  }
}

function findOpponent(opponents, ownerId) {
  return ownerId ? (opponents || []).find((o) => o.id === ownerId) || null : null
}

function parsePrice(price) {
  return price === '' || price == null ? null : Math.max(0, Number(price) || 0)
}

function takenLabel(playerName, owner, price) {
  if (!owner) return `${playerName} — preso da un avversario`
  return price != null ? `${playerName} — a ${owner.name} (${price} cr)` : `${playerName} — a ${owner.name}`
}

export const useStore = create(
  persist(
    (set, get) => ({
      // --- stato persistito ---
      leagueConfig: DEFAULT_LEAGUE_CONFIG,
      players: [],
      playersUpdatedAt: null,
      draftByPlayerId: {},
      theme: null, // null = segue il sistema; 'light' | 'dark' = scelta esplicita

      setTheme: (theme) => set({ theme }),

      // --- stato transitorio (escluso dalla persistenza, vedi partialize) ---
      playersLoading: false,
      playersError: null,
      filters: DEFAULT_FILTERS,
      activeTab: 'cerca', // 'cerca' | 'suggerimenti'
      showLeagueConfigModal: false,
      lastAction: null, // { playerId, previousEntry, label } — per l'UndoToast
      // Calciatore aperto nel pannello "in asta ora" (solo su schermi larghi).
      selectedPlayerId: null,
      // Cache di dettagli calciatore recuperati on-demand (non tutti i 500+ insieme):
      // { [id]: { status: 'loading'|'ready'|'error', data?, error? } }
      playerDetailsById: {},

      // --- config lega ---
      setLeagueConfig: (config) => set({ leagueConfig: normalizeLeagueConfig(config) }),
      setShowLeagueConfigModal: (v) => set({ showLeagueConfigModal: v }),

      // --- quotazioni ---
      async fetchQuotazioni() {
        set({ playersLoading: true, playersError: null })
        try {
          const { players } = await apiFetchQuotazioni()
          set({ players, playersUpdatedAt: new Date().toISOString(), playersLoading: false })
        } catch (err) {
          set({
            playersLoading: false,
            playersError: err.message || 'Impossibile recuperare le quotazioni.',
          })
        }
      },

      // Selezionare un calciatore ne carica anche la scheda: durante l'asta i
      // dati devono essere già lì quando servono, non dopo un secondo click.
      selectPlayer: (player) => {
        set({ selectedPlayerId: player?.id ?? null })
        if (player?.profileUrl) get().fetchPlayerDetails(player)
      },

      // --- dettaglio calciatore on-demand ---
      async fetchPlayerDetails(player) {
        const existing = get().playerDetailsById[player.id]
        if (existing?.status === 'loading' || existing?.status === 'ready') return
        set({ playerDetailsById: { ...get().playerDetailsById, [player.id]: { status: 'loading' } } })
        try {
          const data = await apiFetchPlayerDetails(player)
          set({ playerDetailsById: { ...get().playerDetailsById, [player.id]: { status: 'ready', data } } })
        } catch (err) {
          set({
            playerDetailsById: {
              ...get().playerDetailsById,
              [player.id]: { status: 'error', error: err.message || 'Impossibile recuperare i dettagli.' },
            },
          })
        }
      },

      // --- filtri e navigazione ---
      setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      // --- asta: marcare i calciatori ---
      markMine: (player, price) => {
        const previousEntry = get().draftByPlayerId[player.id] || null
        const numericPrice = Number(price) || 0
        set({
          draftByPlayerId: {
            ...get().draftByPlayerId,
            [player.id]: {
              status: 'mine',
              price: numericPrice,
              takenAt: new Date().toISOString(),
              ...snapshotFromPlayer(player),
            },
          },
          lastAction: {
            playerId: player.id,
            previousEntry,
            label: `${player.name} — Mio (${numericPrice} cr)`,
          },
        })
      },

      // Chi l'ha preso e a quanto: facoltativi per non bloccare mai la
      // registrazione in asta, ma senza di loro i conti sugli avversari non
      // tornano (vedi getUnassignedTaken).
      markTaken: (player, { ownerId = null, price = null } = {}) => {
        const previousEntry = get().draftByPlayerId[player.id] || null
        const owner = findOpponent(get().leagueConfig.opponents, ownerId)
        const numericPrice = parsePrice(price)
        set({
          draftByPlayerId: {
            ...get().draftByPlayerId,
            [player.id]: {
              status: 'taken',
              price: numericPrice,
              ownerId: owner ? owner.id : null,
              takenAt: new Date().toISOString(),
              ...snapshotFromPlayer(player),
            },
          },
          lastAction: {
            playerId: player.id,
            previousEntry,
            label: takenLabel(player.name, owner, numericPrice),
          },
        })
      },

      // Correzione a posteriori di un acquisto avversario (squadra o prezzo),
      // ad esempio dalla lista dei non attribuiti.
      updateTaken: (playerId, patch) => {
        const entry = get().draftByPlayerId[playerId]
        if (!entry || entry.status !== 'taken') return
        const next = { ...entry }
        if ('ownerId' in patch) {
          next.ownerId = findOpponent(get().leagueConfig.opponents, patch.ownerId)?.id ?? null
        }
        if ('price' in patch) next.price = parsePrice(patch.price)
        set({ draftByPlayerId: { ...get().draftByPlayerId, [playerId]: next } })
      },

      freePlayer: (playerId, playerName) => {
        const previousEntry = get().draftByPlayerId[playerId] || null
        const next = { ...get().draftByPlayerId }
        delete next[playerId]
        set({
          draftByPlayerId: next,
          lastAction: previousEntry
            ? { playerId, previousEntry, label: `${playerName || 'Giocatore'} — liberato` }
            : null,
        })
      },

      undoLastAction: () => {
        const { lastAction } = get()
        if (!lastAction) return
        const next = { ...get().draftByPlayerId }
        if (lastAction.previousEntry) {
          next[lastAction.playerId] = lastAction.previousEntry
        } else {
          delete next[lastAction.playerId]
        }
        set({ draftByPlayerId: next, lastAction: null })
      },

      clearLastAction: () => set({ lastAction: null }),

      resetDraft: () => set({ draftByPlayerId: {}, lastAction: null }),

      // --- backup manuale ---
      exportState: () => {
        const { leagueConfig, players, playersUpdatedAt, draftByPlayerId } = get()
        return {
          version: STORAGE_VERSION,
          exportedAt: new Date().toISOString(),
          leagueConfig,
          players,
          playersUpdatedAt,
          draftByPlayerId,
        }
      },

      importState: (data) => {
        if (!data || typeof data !== 'object') throw new Error('file non valido')
        set({
          leagueConfig: normalizeLeagueConfig(data.leagueConfig),
          players: Array.isArray(data.players) ? data.players : [],
          playersUpdatedAt: data.playersUpdatedAt || null,
          draftByPlayerId: data.draftByPlayerId || {},
        })
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // Lo stato salvato prima dell'arrivo degli avversari non ha la loro
      // lista: si normalizza al caricamento.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        leagueConfig: normalizeLeagueConfig(persisted?.leagueConfig),
      }),
      partialize: (state) => ({
        leagueConfig: state.leagueConfig,
        players: state.players,
        playersUpdatedAt: state.playersUpdatedAt,
        draftByPlayerId: state.draftByPlayerId,
        theme: state.theme,
      }),
    }
  )
)

// Nome della squadra avversaria che ha preso un calciatore (null se non
// attribuito): selettore puntuale, così le righe del listone non si
// ri-renderizzano per ogni cambiamento dello store.
export const useOpponentName = (ownerId) =>
  useStore((s) => (ownerId ? (s.leagueConfig.opponents.find((o) => o.id === ownerId)?.name ?? null) : null))
