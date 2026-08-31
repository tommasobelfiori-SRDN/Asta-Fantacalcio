import Foundation

// MARK: - Dal backend (/api/quotazioni)

struct Player: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let team: String
    let roleClassic: String // P / D / C / A
    let quotazioneClassicAttuale: Int?
    let fvmClassic: Int?
    let penaltyRank: Int?
    let prevSeason: PrevSeason?
    let status: PlayerStatus?
}

struct PrevSeason: Codable, Hashable {
    let season: String?
    let presenze: Int?
    let mediaVoto: Double?
    let fantamedia: Double?
    let gol: Int?
    let golSubiti: Int?
    let assist: Int?
    let rigoriSegnati: Int?
    let rigoriCalciati: Int?
    let rigoriParati: Int?
    let ammonizioni: Int?
    let espulsioni: Int?
}

struct PlayerStatus: Codable, Hashable {
    let tipo: String // infortunato / squalificato / diffidato
    let nota: String?
}

struct QuotazioniResponse: Codable {
    let players: [Player]
    let previousSeason: String?
    let fetchedAt: String?
}

// MARK: - Dal backend (/api/probabili)

struct ProbabiliResponse: Codable {
    let byPlayerId: [String: ProbEntry]
    let lastUpdate: String?
    let fetchedAt: String?
}

struct ProbEntry: Codable, Hashable {
    let team: String
    let starter: Bool
    let pct: Double?
}

// MARK: - Export dell'app asta (stesso JSON di "Esporta stato")

struct AstaExport: Codable {
    struct DraftEntry: Codable {
        let status: String // mine / taken
        let price: Double?
    }
    let draftByPlayerId: [String: DraftEntry]

    var myPlayerIds: [String] {
        draftByPlayerId.filter { $0.value.status == "mine" }.map(\.key)
    }
}

// MARK: - Formazione calcolata

struct LineupSlot: Identifiable, Hashable {
    var id: String { player.id }
    let player: Player
    let prob: ProbEntry?
    let score: Double
    let note: String? // motivo leggibile (es. "ballottaggio 50%", "infortunato")
}

struct Lineup {
    let module: String // es. "3-4-3"
    let starters: [LineupSlot] // ordinati P, D..., C..., A...
    let bench: [LineupSlot] // in ordine di ingresso consigliato
    let excluded: [LineupSlot] // fuori per infortunio/squalifica

    var startersByRole: [String: [LineupSlot]] {
        Dictionary(grouping: starters, by: { $0.player.roleClassic })
    }

    /// Testo pronto da incollare nella chat di lega o da leggere al volo.
    var shareText: String {
        var lines = ["Formazione (\(module)):"]
        for role in ["P", "D", "C", "A"] {
            let names = (startersByRole[role] ?? []).map(\.player.name).joined(separator: ", ")
            if !names.isEmpty { lines.append("\(role): \(names)") }
        }
        let benchNames = bench.prefix(7).map(\.player.name).joined(separator: ", ")
        if !benchNames.isEmpty { lines.append("Panchina: \(benchNames)") }
        return lines.joined(separator: "\n")
    }
}

// MARK: - Impostazioni

struct AppSettings: Codable {
    var leagueURL: String = ""
    /// Promemoria del venerdì (le probabili si assestano in serata).
    var fridayReminderHour: Int = 18
    var fridayReminderMinute: Int = 0
    /// Notifica del sabato con la formazione già pronta nel testo.
    var saturdayLineupHour: Int = 11
    var saturdayLineupMinute: Int = 30
    var statusAlertsEnabled: Bool = true
    /// Buco per l'API di Claude: la chiave la inserisce Tommaso dalle Impostazioni.
    var claudeAPIKey: String = ""
    var claudeModel: String = "claude-sonnet-4-6"
}
