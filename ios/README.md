# Schiera — companion iPhone

L'app che ti accompagna durante la stagione: ogni settimana calcola la
formazione migliore dalla tua rosa e te la mette in una notifica il sabato
mattina, già pronta nel testo. Design "Almanacco", lo stesso del sito
(mockup nel file Figma, pagina "Companion iPhone").

## Come funziona

- **Rosa**: importi il file "Esporta stato" dell'app dell'asta (o incolli il
  JSON). Da lì la rosa vive qui, agganciata per ID al listone.
- **Dati**: le stesse Cloud Functions del sito (`/api/quotazioni`,
  `/api/probabili`) — quotazioni, statistiche 2025/26, rigoristi,
  indisponibili con nota, probabili formazioni con percentuale di titolarità.
  Ogni risposta è in cache su disco: senza rete l'app usa gli ultimi dati.
- **Motore formazione** (`LineupEngine.swift`): regole dichiarate e spiegabili —
  titolarità dalle probabili come base, fantamedia come correttivo (dimezzata
  sotto le 10 presenze), bonus rigorista, malus diffidato, esclusi infortunati
  e squalificati. Sceglie il modulo che massimizza il totale tra i sette
  moduli Classic e ordina la panchina per ingresso.
- **Notifiche** (locali, niente server push): venerdì il promemoria, sabato la
  formazione nel corpo della notifica, e un'allerta immediata se un tuo
  giocatore si infortuna o viene squalificato tra un refresh e l'altro. Il
  refresh in background (BGAppRefreshTask) tiene aggiornato il contenuto.
- **Claude** (`ClaudeService.swift`): il buco è pronto — chiave e modello si
  inseriscono nelle Impostazioni, e il bottone "Chiedi un parere" fa rileggere
  la formazione a Claude. Senza chiave tutto il resto funziona.

## Build

```bash
cd ios && xcodegen generate
open Schiera.xcodeproj
```

Richiede il deploy delle functions aggiornate (endpoint `probabili`):

```bash
firebase deploy --only functions,hosting
```
