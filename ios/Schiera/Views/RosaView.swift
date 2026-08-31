import SwiftUI
import UniformTypeIdentifiers

// La rosa arriva dall'app dell'asta: si importa il file di "Esporta stato"
// (o si incolla il JSON), e da lì il companion la segue tutta la stagione.
struct RosaView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showImporter = false
    @State private var showPaste = false
    @State private var pastedJSON = ""
    @State private var importError: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        CapsLabel(text: "\(store.roster.count) calciatori · dall'asta", size: 10)
                        Text("La rosa")
                            .font(.nome(28, weight: .bold))
                            .italic()
                            .foregroundStyle(Palette.inchiostro)
                    }

                    if store.roster.isEmpty {
                        Text("Importa l'export dell'asta per cominciare: il file che scarichi con \"Esporta\" dalla barra laterale del sito.")
                            .font(.system(size: 14))
                            .foregroundStyle(Palette.attenuato)
                    } else {
                        rosterList
                    }

                    if let importError {
                        Text(importError)
                            .font(.system(size: 13))
                            .foregroundStyle(Palette.granata)
                    }

                    VStack(spacing: 8) {
                        Button { showImporter = true } label: { Text("Importa l'export dell'asta") }
                            .buttonStyle(InkButtonStyle(prominent: store.roster.isEmpty))
                        Button { showPaste = true } label: { Text("Incolla il JSON") }
                            .buttonStyle(InkButtonStyle(prominent: false))
                    }
                }
                .padding(18)
            }
            .background(Palette.carta)
            .refreshable { await store.refresh() }
            .fileImporter(isPresented: $showImporter, allowedContentTypes: [.json]) { result in
                handleFile(result)
            }
            .sheet(isPresented: $showPaste) { pasteSheet }
        }
    }

    private var rosterList: some View {
        VStack(spacing: 0) {
            ForEach(store.roster) { player in
                let prob = store.probabili[player.id]
                HStack(spacing: 10) {
                    RoleBadge(role: player.roleClassic, side: 24)
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 6) {
                            Text(player.name).font(.nome(16)).foregroundStyle(Palette.inchiostro)
                            if player.penaltyRank == 1 {
                                Text("R")
                                    .font(.etichetta(10))
                                    .foregroundStyle(Palette.carta)
                                    .frame(width: 15, height: 15)
                                    .background(Circle().fill(Palette.campo))
                            }
                        }
                        Text(statusLine(player: player, prob: prob))
                            .font(.numero(11, weight: .regular))
                            .foregroundStyle(statusColor(player: player, prob: prob))
                            .lineLimit(1)
                    }
                    Spacer()
                    if let fm = player.prevSeason?.fantamedia {
                        Text(String(format: "%.2f", fm).replacingOccurrences(of: ".", with: ","))
                            .font(.numero(14))
                            .foregroundStyle(fm >= 7 ? Palette.campo : (fm < 6 ? Palette.granata : Palette.inchiostro))
                    }
                }
                .padding(.vertical, 9)
                .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Palette.attenuato.opacity(0.4)), alignment: .bottom)
            }
        }
    }

    private func statusLine(player: Player, prob: ProbEntry?) -> String {
        if let status = player.status {
            return status.nota.map { "\(status.tipo) · \($0)" } ?? status.tipo
        }
        guard let prob else { return "fuori dalle probabili" }
        let pct = prob.pct.map { "\(Int($0))%" } ?? "—"
        if prob.starter { return "titolare · \(pct)" }
        if (prob.pct ?? 0) >= 30 { return "ballottaggio · \(pct)" }
        return "in panchina · \(pct)"
    }

    private func statusColor(player: Player, prob: ProbEntry?) -> Color {
        if let tipo = player.status?.tipo {
            return tipo == "diffidato" ? Palette.ocra : Palette.granata
        }
        if prob?.starter == true { return Palette.campo }
        return Palette.attenuato
    }

    private var pasteSheet: some View {
        NavigationStack {
            VStack(spacing: 12) {
                TextEditor(text: $pastedJSON)
                    .font(.numero(12, weight: .regular))
                    .frame(minHeight: 220)
                    .overlay(Rectangle().strokeBorder(Palette.inchiostro, lineWidth: 1.5))
                Button {
                    importData(Data(pastedJSON.utf8))
                    if importError == nil { showPaste = false; pastedJSON = "" }
                } label: { Text("Importa") }
                    .buttonStyle(InkButtonStyle())
            }
            .padding(18)
            .background(Palette.carta)
            .navigationTitle("Incolla il JSON")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func handleFile(_ result: Result<URL, Error>) {
        guard case .success(let url) = result else { return }
        let secured = url.startAccessingSecurityScopedResource()
        defer { if secured { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            importError = "Impossibile leggere il file."
            return
        }
        importData(data)
    }

    private func importData(_ data: Data) {
        do {
            try store.importAstaExport(data)
            importError = nil
        } catch {
            importError = error.localizedDescription
        }
    }
}
