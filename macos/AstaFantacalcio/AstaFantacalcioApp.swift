import SwiftUI

@main
struct AstaFantacalcioApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .defaultSize(width: 1280, height: 860)
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
            .frame(minWidth: 900, minHeight: 600)
        // Il colore della barra del titolo lo detta la pagina: il sito notifica
        // il tema effettivo (chiaro/scuro) e WebView.Coordinator tinge la finestra.
    }
}
