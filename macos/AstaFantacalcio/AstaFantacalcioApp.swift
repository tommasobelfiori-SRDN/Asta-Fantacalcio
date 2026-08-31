import SwiftUI

@main
struct AstaFantacalcioApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        // Sopra i 1280 punti il sito affianca il banco d'asta al listone: la
        // finestra parte già abbastanza larga da mostrarlo.
        .defaultSize(width: 1440, height: 900)
        .commands {
            CommandGroup(after: .toolbar) {
                Button("Ricarica") {
                    NotificationCenter.default.post(name: .reloadWebView, object: nil)
                }
                .keyboardShortcut("r", modifiers: .command)
            }
        }
    }
}

extension Notification.Name {
    static let reloadWebView = Notification.Name("reloadWebView")
}

struct ContentView: View {
    var body: some View {
        WebView(url: URL(string: "https://fantacalcio-asta-tb.web.app")!)
            .frame(minWidth: 1000, minHeight: 640)
        // Il colore della barra del titolo lo detta la pagina: il sito notifica
        // il tema effettivo (chiaro/scuro) e WebView.Coordinator tinge la finestra.
    }
}
