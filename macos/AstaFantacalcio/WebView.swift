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

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsMagnification = true
        webView.load(URLRequest(url: url))

        context.coordinator.observer = NotificationCenter.default.addObserver(
            forName: .reloadWebView, object: nil, queue: .main
        ) { [weak webView] _ in
            webView?.reload()
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var observer: NSObjectProtocol?

        deinit {
            if let observer { NotificationCenter.default.removeObserver(observer) }
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
