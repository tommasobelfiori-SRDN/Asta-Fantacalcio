export const CLASSIC_ROLES = ['P', 'D', 'C', 'A']

export const ROLE_LABELS = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
}

export const ROLE_BADGE_CLASSES = {
  P: 'bg-amber-100 text-amber-800 border-amber-300',
  D: 'bg-sky-100 text-sky-800 border-sky-300',
  C: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  A: 'bg-rose-100 text-rose-800 border-rose-300',
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
