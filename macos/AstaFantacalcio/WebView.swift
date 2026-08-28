import SwiftUI
import WebKit

/// Incapsula il sito live. Lo stato dell'asta vive nel localStorage del
/// WKWebsiteDataStore persistente di default, dentro il container sandbox
/// dell'app: sopravvive a riavvii e aggiornamenti dell'app.
struct WebView: NSViewRepresentable {
    let url: URL

    // Host che restano dentro l'app; tutto il resto (schede fantacalcio.it,
    // Transfermarkt) si apre nel browser di sistema.
    private static let internalHosts: Set<String> = [
        "fantacalcio-asta-tb.web.app",
        "fantacalcio-asta-tb.firebaseapp.com",
    ]

    // La pagina segnala il tema effettivo (classe `dark` sull'html, gestita dal
    // sito tra scelta esplicita e preferenza di sistema): la barra del titolo
    // della finestra prende lo stesso colore carta, chiara o notturna.
    private static let themeObserverScript = """
        (function () {
          function report() {
            window.webkit?.messageHandlers?.theme?.postMessage(
              document.documentElement.classList.contains('dark') ? 'dark' : 'light'
            );
          }
          new MutationObserver(report).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
          });
          report();
        })();
        """

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.addUserScript(
            WKUserScript(source: Self.themeObserverScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
        config.userContentController.add(context.coordinator, name: "theme")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsMagnification = true
        // Rivalida sempre l'index col server (ETag): un deploy del sito arriva
        // all'app al riavvio, senza aspettare la scadenza della cache locale.
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        context.coordinator.webView = webView

        context.coordinator.observer = NotificationCenter.default.addObserver(
            forName: .reloadWebView, object: nil, queue: .main
        ) { [weak webView] _ in
            webView?.reloadFromOrigin()
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var observer: NSObjectProtocol?
        weak var webView: WKWebView?

        deinit {
            if let observer { NotificationCenter.default.removeObserver(observer) }
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "theme", let theme = message.body as? String else { return }
            DispatchQueue.main.async { [weak self] in
                guard let window = self?.webView?.window else { return }
                let dark = theme == "dark"
                window.titlebarAppearsTransparent = true
                window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
                window.backgroundColor = dark
                    ? NSColor(srgbRed: 0.118, green: 0.102, blue: 0.078, alpha: 1) // #1E1A14
                    : NSColor(srgbRed: 0.965, green: 0.945, blue: 0.902, alpha: 1) // #F6F1E6
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let target = navigationAction.request.url, let host = target.host else {
                decisionHandler(.allow)
                return
            }
            if WebView.internalHosts.contains(host) {
                decisionHandler(.allow)
            } else {
                NSWorkspace.shared.open(target)
                decisionHandler(.cancel)
            }
        }

        // Link con target=_blank (schede esterne): sempre nel browser di sistema.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let target = navigationAction.request.url {
                NSWorkspace.shared.open(target)
            }
            return nil
        }
    }
}
