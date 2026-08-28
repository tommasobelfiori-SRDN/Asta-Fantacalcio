export const CLASSIC_ROLES = ['P', 'D', 'C', 'A']

export const ROLE_LABELS = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
}

export const ROLE_LABELS_PLURAL = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

// Quadratino ruolo in stile almanacco: bordo e lettera nel colore maglia.
export const ROLE_BADGE_CLASSES = {
  P: 'border-ocra text-ocra',
  D: 'border-azzurro text-azzurro',
  C: 'border-campo text-campo',
  A: 'border-granata text-granata',
}

// Variante piena (rosa in sidebar, slot con giocatori presi).
export const ROLE_FILL_CLASSES = {
  P: 'border-ocra bg-ocra text-paper',
  D: 'border-azzurro bg-azzurro text-paper',
  C: 'border-campo bg-campo text-paper',
  A: 'border-granata bg-granata text-paper',
}

// Formazione Classic standard: 3 portieri, 8 difensori, 8 centrocampisti, 6 attaccanti.
export const DEFAULT_LEAGUE_CONFIG = {
  totalCredits: 500,
  roles: { P: 3, D: 8, C: 8, A: 6 },
}

// Etichette dei ruoli Mantra (mostrati in tabella, non usati nel motore suggerimenti in v1).
export const MANTRA_ROLE_LABELS = {
  por: 'Portiere',
  ds: 'Difensore sinistro',
  dd: 'Difensore destro',
  dc: 'Difensore centrale',
  b: 'Braccetto',
  e: 'Esterno',
  m: 'Mediano',
  c: 'Centrocampista',
  t: 'Trequartista',
  w: 'Ala',
  pc: 'Punta centrale',
  a: 'Attaccante',
}
