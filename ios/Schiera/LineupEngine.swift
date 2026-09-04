import Foundation

// Il motore che decide chi schierare. Regole dichiarate, niente scatole nere:
// ogni punteggio è spiegabile in una riga, e la spiegazione finisce nella UI.
//
// Punteggio di un giocatore per la giornata:
//   base   = percentuale di titolarità dalle probabili (chi non compare: 15)
//   +12    se è nell'XI titolare delle probabili
//   +/-    fantamedia dell'ultima stagione: (FM - 6) × 8, tagliata a [-12, +16];
//          dimezzata sotto le 10 presenze (media poco affidabile)
//   +8/+3  rigorista titolare / seconda scelta
//   -3     diffidato (gioca, ma un giallo lo ferma la prossima)
//   escluso se infortunato o squalificato
enum LineupEngine {
    /// Moduli ammessi nel Classic.
    static let modules: [(String, d: Int, c: Int, a: Int)] = [
        ("3-4-3", 3, 4, 3), ("3-5-2", 3, 5, 2), ("4-3-3", 4, 3, 3),
        ("4-4-2", 4, 4, 2), ("4-5-1", 4, 5, 1), ("5-3-2", 5, 3, 2), ("5-4-1", 5, 4, 1),
    ]

    static func score(player: Player, prob: ProbEntry?) -> (score: Double, note: String?)? {
        if player.ceduto == true { return nil }
        if let tipo = player.status?.tipo, tipo == "infortunato" || tipo == "squalificato" {
            return nil // fuori: non è una scelta, è un fatto
        }

        var score = prob?.pct ?? 15
        var notes: [String] = []
        if let prob {
            if prob.starter { score += 12 }
            if let pct = prob.pct {
                if pct >= 100 { notes.append("titolare") }
                else if prob.starter { notes.append("titolare · \(Int(pct))%") }
                else if pct >= 30 { notes.append("ballottaggio · \(Int(pct))%") }
                else { notes.append("panchina · \(Int(pct))%") }
            }
        } else {
            notes.append("fuori dalle probabili")
        }

        if let fm = player.prevSeason?.fantamedia {
            var bonus = min(16, max(-12, (fm - 6) * 8))
            if (player.prevSeason?.presenze ?? 0) < 10 { bonus /= 2 }
            score += bonus
        }
        if player.penaltyRank == 1 { score += 8; notes.append("rigorista") }
        if player.penaltyRank == 2 { score += 3 }
        if player.status?.tipo == "diffidato" { score -= 3; notes.append("diffidato") }

        return (score, notes.isEmpty ? nil : notes.joined(separator: " · "))
    }

    static func build(roster: [Player], probabili: [String: ProbEntry]) -> Lineup? {
        var slots: [LineupSlot] = []
        var excluded: [LineupSlot] = []
        for player in roster {
            let prob = probabili[player.id]
            if let result = score(player: player, prob: prob) {
                slots.append(LineupSlot(player: player, prob: prob, score: result.score, note: result.note))
            } else {
                excluded.append(LineupSlot(player: player, prob: prob, score: -1,
                                           note: player.ceduto == true ? "ceduto" : (player.status?.tipo ?? "indisponibile")))
            }
        }

        let byRole = Dictionary(grouping: slots, by: { $0.player.roleClassic })
            .mapValues { $0.sorted { $0.score > $1.score } }
        guard let keeper = byRole["P"]?.first else { return nil }

        // Il modulo migliore è quello che massimizza la somma dei punteggi
        // dei migliori disponibili per reparto, tra i moduli schierabili.
        var best: (module: String, starters: [LineupSlot], total: Double)?
        for (name, d, c, a) in modules {
            guard (byRole["D"]?.count ?? 0) >= d,
                  (byRole["C"]?.count ?? 0) >= c,
                  (byRole["A"]?.count ?? 0) >= a else { continue }
            let starters = [keeper]
                + Array(byRole["D"]!.prefix(d))
                + Array(byRole["C"]!.prefix(c))
                + Array(byRole["A"]!.prefix(a))
            let total = starters.reduce(0) { $0 + $1.score }
            if best == nil || total > best!.total {
                best = (name, starters, total)
            }
        }
        guard let chosen = best else { return nil }

        let starterIds = Set(chosen.starters.map(\.player.id))
        let bench = slots
            .filter { !starterIds.contains($0.player.id) }
            .sorted { $0.score > $1.score }

        return Lineup(module: chosen.module, starters: chosen.starters, bench: bench, excluded: excluded)
    }
}
