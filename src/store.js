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
  sortBy: 'fvm', // 'fvm' | 'prezzo' | 'nome'
}

function snapshotFromPlayer(player) {
  return { name: player.name, team: player.team, roleClassic: player.roleClassic }
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
      setLeagueConfig: (config) => set({ leagueConfig: config }),
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

      markTaken: (player) => {
        const previousEntry = get().draftByPlayerId[player.id] || null
        set({
          draftByPlayerId: {
            ...get().draftByPlayerId,
            [player.id]: {
              status: 'taken',
              price: null,
              takenAt: new Date().toISOString(),
              ...snapshotFromPlayer(player),
            },
          },
          lastAction: {
            playerId: player.id,
            previousEntry,
            label: `${player.name} — preso da un avversario`,
          },
        })
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
          leagueConfig: data.leagueConfig || DEFAULT_LEAGUE_CONFIG,
          players: Array.isArray(data.players) ? data.players : [],
          playersUpdatedAt: data.playersUpdatedAt || null,
          draftByPlayerId: data.draftByPlayerId || {},
        })
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
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
