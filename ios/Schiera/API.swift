import Foundation

// Client verso il backend condiviso con il sito e l'app macOS: le stesse due
// Cloud Functions servono tutti i client. Ogni risposta buona viene salvata su
// disco: durante il weekend l'app funziona anche senza rete, con dati datati
// ma dichiarati.
enum API {
    static let base = URL(string: "https://fantacalcio-asta-tb.web.app/api")!

    enum Endpoint: String {
        case quotazioni
        case probabili
    }

    struct CacheEnvelope<T: Codable>: Codable {
        let savedAt: Date
        let payload: T
    }

    static func cacheURL(_ endpoint: Endpoint) -> URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(endpoint.rawValue).json")
    }

    static func fetch<T: Codable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T {
        var request = URLRequest(url: base.appendingPathComponent(endpoint.rawValue))
        request.timeoutInterval = 30
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        let decoded = try JSONDecoder().decode(T.self, from: data)
        let envelope = CacheEnvelope(savedAt: Date(), payload: decoded)
        if let blob = try? JSONEncoder().encode(envelope) {
            try? blob.write(to: cacheURL(endpoint), options: .atomic)
        }
        return decoded
    }

    static func cached<T: Codable>(_ endpoint: Endpoint, as type: T.Type) -> (payload: T, savedAt: Date)? {
        guard let data = try? Data(contentsOf: cacheURL(endpoint)),
              let envelope = try? JSONDecoder().decode(CacheEnvelope<T>.self, from: data)
        else { return nil }
        return (envelope.payload, envelope.savedAt)
    }
}
