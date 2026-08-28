# Asta Fantacalcio

Assistente personale per l'asta del fantacalcio: quotazioni ufficiali da fantacalcio.it, tracciamento di budget e rosa in tempo reale, suggerimenti sui migliori obiettivi rimanenti in base a chi hai già preso.

Pensato per uso personale, un dispositivo per sessione — nessun account, nessuna sincronizzazione con altri partecipanti. Lo stato (configurazione lega, chi hai preso, prezzi pagati) resta salvato nel browser (`localStorage`); il bottone "Esporta stato" nella barra laterale permette un backup manuale o il passaggio a un altro dispositivo a metà asta.

## Stack

- Frontend: React 18 + Vite + Tailwind CSS, stato con Zustand (`persist` su `localStorage`)
- Backend: una singola Cloud Function Firebase (`functions/index.js`) che recupera e interpreta la pagina pubblica delle quotazioni di fantacalcio.it (nessun login richiesto)

## Sviluppo

```bash
npm install
cd functions && npm install && cd ..

# terminale 1 — emulatore Firebase (serve /api/quotazioni su :5002)
firebase emulators:start --only functions,hosting

# terminale 2 — frontend, proxy /api verso :5002
npm run dev
```

Apri http://localhost:5173, poi premi "Aggiorna quotazioni" per popolare l'elenco calciatori.

## Deploy

Le Cloud Functions richiedono il piano Firebase **Blaze** (pay-as-you-go — si attiva da Firebase Console → Impostazioni progetto → Utilizzo e fatturazione). Per l'uso previsto qui (poche chiamate manuali a sera, poche sere l'anno) il costo atteso resta €0, ben sotto la soglia gratuita mensile.

```bash
npm run build
firebase deploy --only functions,hosting
```

## App macOS

In `macos/` c'è un'app nativa (SwiftUI + WKWebView) che incapsula il sito live: stessa app, finestra dedicata, stato dell'asta persistente nel container sandbox. Il progetto Xcode si rigenera da `project.yml`:

```bash
cd macos
xcodegen generate
DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer" xcodebuild -project AstaFantacalcio.xcodeproj -scheme AstaFantacalcio -configuration Debug CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="-" build
```

Per la distribuzione TestFlight: aprire il progetto in Xcode, impostare il proprio team nella scheda Signing & Capabilities, creare l'app record su App Store Connect con bundle id `com.tommasobelfiori.AstaFantacalcio`, poi Product → Archive → Distribute App → TestFlight.

## Note sui dati

I dati (ruoli, quotazioni, FVM) vengono letti dalla pagina pubblica `fantacalcio.it/quotazioni-fantacalcio`, non protetta da login. Il recupero avviene solo quando premi manualmente "Aggiorna quotazioni" — mai in automatico o in polling continuo. Se il sito cambia struttura, la funzione può smettere di funzionare finché i selettori non vengono aggiornati: **testa l'aggiornamento quotazioni qualche giorno prima dell'asta vera**, non la sera stessa.

## Licenza

MIT — vedi [LICENSE](LICENSE).
