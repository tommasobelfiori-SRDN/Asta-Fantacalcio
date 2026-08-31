import Foundation

// Il "buco" per l'API di Claude, pronto da riempire: Tommaso incolla la sua
// chiave nelle Impostazioni e il bottone "Chiedi un parere" prende vita.
// Senza chiave l'app resta pienamente funzionante col motore deterministico.
enum ClaudeService {
    enum ClaudeError: LocalizedError {
        case missingKey
        case badResponse(String)

        var errorDescription: String? {
            switch self {
            case .missingKey:
                return "Nessuna chiave API: aggiungila nelle Impostazioni per chiedere un parere a Claude."
            case .badResponse(let detail):
                return "Claude non ha risposto: \(detail)"
            }
        }
    }

    /// Chiede a Claude un parere sintetico sulla formazione proposta dal motore.
    static func secondOpinion(lineup: Lineup, giornata: String?, settings: AppSettings) async throws -> String {
        let key = settings.claudeAPIKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { throw ClaudeError.missingKey }

        var context = "Formazione proposta (\(lineup.module))"
        if let giornata { context += " per la \(giornata)" }
        context += ":\n" + lineup.shareText
        if !lineup.excluded.isEmpty {
            let out = lineup.excluded.map { "\($0.player.name) (\($0.note ?? "out"))" }.joined(separator: ", ")
            context += "\nEsclusi: \(out)"
        }
        let benchDetail = lineup.bench.prefix(7)
            .map { "\($0.player.name) [\($0.note ?? "-")]" }
            .joined(separator: ", ")
        context += "\nDettaglio panchina: \(benchDetail)"

        let body: [String: Any] = [
            "model": settings.claudeModel,
            "max_tokens": 400,
            "messages": [[
                "role": "user",
                "content": """
                Sei un consigliere di fantacalcio (Serie A, modalità Classic). \
                Valuta questa formazione proposta da un motore deterministico basato su \
                titolarità delle probabili formazioni, fantamedia della scorsa stagione, \
                rigoristi e indisponibili. Rispondi in italiano, massimo 120 parole: \
                o confermala, o proponi al più due cambi motivandoli.

                \(context)
                """,
            ]],
        ]

        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ClaudeError.badResponse("nessuna risposta") }
        guard http.statusCode == 200 else {
            let detail = String(data: data, encoding: .utf8)?.prefix(200) ?? "status \(http.statusCode)"
            throw ClaudeError.badResponse(String(detail))
        }

        struct MessagesResponse: Codable {
            struct Block: Codable { let type: String; let text: String? }
            let content: [Block]
        }
        let decoded = try JSONDecoder().decode(MessagesResponse.self, from: data)
        let text = decoded.content.compactMap(\.text).joined(separator: "\n")
        guard !text.isEmpty else { throw ClaudeError.badResponse("risposta vuota") }
        return text
    }
}
