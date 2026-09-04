#!/bin/bash
# Compila Schiera e la installa sull'iPhone collegato, poi la avvia.
#
# Da rilanciare ogni volta che cambia il codice dell'app, e comunque una volta a
# settimana: le build firmate con un profilo di sviluppo scadono dopo 7 giorni e
# l'app smette di aprirsi. Prima di lanciarlo, sblocca il telefono e lascialo
# sbloccato: senza schermo attivo iOS rifiuta di montare i servizi di sviluppo.
#
#   ./ios/installa.sh
set -euo pipefail

# Su questo Mac c'è solo Xcode beta, in Downloads: senza questa riga xcodebuild
# non trova nemmeno l'SDK iOS.
XCODE="${XCODE:-$HOME/Downloads/Xcode-beta 2.app}"
[ -d "$XCODE" ] || { echo "Xcode non trovato in $XCODE — indica il percorso con XCODE=..."; exit 1; }
export DEVELOPER_DIR="$XCODE/Contents/Developer"

cd "$(dirname "$0")"

# L'identificativo è l'unico UUID sulla riga; il nome del modello contiene spazi
# e sposterebbe le colonne ("iPhone 14 Pro Max" conta come quattro campi).
DEVICE=$(xcrun devicectl list devices 2>/dev/null | grep physical |
  grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)
[ -n "$DEVICE" ] || { echo "Nessun iPhone collegato."; exit 1; }
echo "Dispositivo: $DEVICE"

xcodegen generate >/dev/null
xcodebuild -project Schiera.xcodeproj -scheme Schiera -configuration Debug \
  -destination "generic/platform=iOS" -derivedDataPath build \
  -allowProvisioningUpdates build >/dev/null
echo "Build completata."

APP=build/Build/Products/Debug-iphoneos/Schiera.app
if ! xcrun devicectl device install app --device "$DEVICE" "$APP"; then
  echo
  echo "Installazione fallita. Se l'errore dice che il dispositivo è bloccato,"
  echo "sblocca l'iPhone, lascialo acceso e rilancia questo comando."
  exit 1
fi

xcrun devicectl device process launch --device "$DEVICE" com.tommasobelfiori.Schiera
echo "Schiera installata e avviata."
