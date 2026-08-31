import Foundation
import SwiftUI
import BackgroundTasks

// Lo stato dell'app: rosa importata dall'asta, dati dal backend, impostazioni.
// Tutto persistito come JSON in Application Support — la stessa filosofia
// dell'app web (nessun account, i dati vivono sul dispositivo).
@MainActor
final class AppStore: ObservableObject {
    static let refreshTaskId = "com.tommasobelfiori.schiera.refresh"

    @Published var players: [Player] = []
    @Published var probabili: [String: ProbEntry] = [:]
    @Published var probabiliLastUpdate: String?
    @Published var rosterIds: [String] = []
    @Published var settings = AppSettings() { didSet { persistSettings() } }
    @Published var lastSync: Date?
    @Published var isRefreshing = false
    @Published var lastError: String?

    var roster: [Player] {
        let byId = Dictionary(uniqueKeysWithValues: players.map { ($0.id, $0) })
        return rosterIds.compactMap { byId[$0] }
            .sorted { roleOrder($0.roleClassic) < roleOrder($1.roleClassic) }
    }

    var lineup: Lineup? {
        LineupEngine.build(roster: roster, probabili: probabili)
    }

    init() {
        restore()
    }

    // MARK: - Refresh

    /// Scarica quotazioni e probabili; confronta lo stato dei TUOI giocatori con
    /// il giro precedente e, se qualcuno è peggiorato, manda l'allerta immediata.
    func refresh(inBackground: Bool = false) async {
        if !inBackground { isRefreshing = true }
        defer { if !inBackground { isRefreshing = false } }

        let previousStatus = Dictionary(uniqueKeysWithValues: roster.map { ($0.id, $0.status?.tipo) })

        do {
            async let quotazioni = API.fetch(.quotazioni, as: QuotazioniResponse.self)
            async let prob = API.fetch(.probabili, as: ProbabiliResponse.self)
            let (q, p) = try await (quotazioni, prob)
            players = q.players
            probabili = p.byPlayerId
            probabiliLastUpdate = p.lastUpdate
            lastSync = Date()
            lastError = nil

            if settings.statusAlertsEnabled {
                for player in roster {
                    let old = previousStatus[player.id] ?? nil
                    let new = player.status?.tipo
                    let worsened = (new == "infortunato" || new == "squalificato") && old != new
                    if worsened {
                        NotificationManager.sendStatusAlert(
                            playerName: player.name, tipo: new ?? "", nota: player.status?.nota
                        )
                    }
                }
            }
        } catch {
            // Rete giù o backend irraggiungibile: si continua con la cache.
            lastError = "Aggiornamento non riuscito: uso gli ultimi dati salvati."
            if players.isEmpty, let cached = API.cached(.quotazioni, as: QuotazioniResponse.self) {
                players = cached.payload.players
                lastSync = cached.savedAt
            }
            if probabili.isEmpty, let cached = API.cached(.probabili, as: ProbabiliResponse.self) {
                probabili = cached.payload.byPlayerId
                probabiliLastUpdate = cached.payload.lastUpdate
            }
        }

        NotificationManager.scheduleWeekly(settings: settings, lineup: lineup, giornata: nil)
        scheduleBackgroundRefresh()
    }

    // MARK: - Import rosa (l'export JSON dell'app asta)

    func importAstaExport(_ data: Data) throws {
        let export = try JSONDecoder().decode(AstaExport.self, from: data)
        let ids = export.myPlayerIds
        guard !ids.isEmpty else {
            throw NSError(domain: "Schiera", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Nel file non c'è nessun calciatore segnato come tuo.",
            ])
        }
        rosterIds = ids
        persistRoster()
    }

    // MARK: - Background refresh

    nonisolated static func registerBackgroundTask(store: AppStore) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshTaskId, using: nil) { task in
            guard let refreshTask = task as? BGAppRefreshTask else { return }
            let work = Task { @MainActor in
                await store.refresh(inBackground: true)
                refreshTask.setTaskCompleted(success: true)
            }
            refreshTask.expirationHandler = { work.cancel() }
        }
    }

    func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 3600)
        try? BGTaskScheduler.shared.submit(request)
    }

    // MARK: - Persistenza

    private func roleOrder(_ role: String) -> Int {
        ["P": 0, "D": 1, "C": 2, "A": 3][role] ?? 4
    }

    private var rosterURL: URL { supportFile("roster.json") }
    private var settingsURL: URL { supportFile("settings.json") }

    private func supportFile(_ name: String) -> URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(name)
    }

    private func persistRoster() {
        if let data = try? JSONEncoder().encode(rosterIds) {
            try? data.write(to: rosterURL, options: .atomic)
        }
    }

    private func persistSettings() {
        if let data = try? JSONEncoder().encode(settings) {
            try? data.write(to: settingsURL, options: .atomic)
        }
    }

    private func restore() {
        if let data = try? Data(contentsOf: rosterURL),
           let ids = try? JSONDecoder().decode([String].self, from: data) {
            rosterIds = ids
        }
        if let data = try? Data(contentsOf: settingsURL),
           let restored = try? JSONDecoder().decode(AppSettings.self, from: data) {
            settings = restored
        }
        if let cached = API.cached(.quotazioni, as: QuotazioniResponse.self) {
            players = cached.payload.players
            lastSync = cached.savedAt
        }
        if let cached = API.cached(.probabili, as: ProbabiliResponse.self) {
            probabili = cached.payload.byPlayerId
            probabiliLastUpdate = cached.payload.lastUpdate
        }
    }
}
