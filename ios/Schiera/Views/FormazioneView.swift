import SwiftUI

// La schermata principale: il campo verde con l'XI consigliato per reparti,
// la panchina in ordine di ingresso, e le due azioni (apri la lega, Claude).
struct FormazioneView: View {
    @EnvironmentObject private var store: AppStore
    @State private var claudeOpinion: String?
    @State private var claudeLoading = false
    @State private var claudeError: String?
    @State private var copied = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header

                    if store.rosterIds.isEmpty {
                        emptyRoster
                    } else if let lineup = store.lineup {
                        pitch(lineup)
                        if !lineup.excluded.isEmpty { excludedSection(lineup) }
                        benchSection(lineup)
                        actions(lineup)
                        if claudeLoading { ProgressView().frame(maxWidth: .infinity) }
                        if let claudeOpinion { opinionBox(claudeOpinion) }
                        if let claudeError {
                            Text(claudeError)
                                .font(.system(size: 13))
                                .foregroundStyle(Palette.granata)
                        }
                    } else {
                        Text("Aggiorna i dati per calcolare la formazione.")
                            .font(.nome(15))
                            .italic()
                            .foregroundStyle(Palette.attenuato)
                    }
                }
                .padding(18)
            }
            .background(Palette.carta)
            .refreshable { await store.refresh() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            CapsLabel(text: "Serie A · \(store.probabiliLastUpdate ?? "probabili non ancora caricate")", size: 10)
            Text("La formazione")
                .font(.nome(28, weight: .bold))
                .italic()
                .foregroundStyle(Palette.inchiostro)
            if let error = store.lastError {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.ocra)
            }
        }
    }

    private var emptyRoster: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Nessuna rosa importata")
                .font(.nome(18))
                .foregroundStyle(Palette.inchiostro)
            Text("Vai in Rosa e importa il file \"Esporta stato\" dell'app dell'asta: da lì in poi penso a tutto io.")
                .font(.system(size: 14))
                .foregroundStyle(Palette.attenuato)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(Rectangle().strokeBorder(Palette.inchiostro, lineWidth: 1.5))
    }

    private func pitch(_ lineup: Lineup) -> some View {
        VStack(spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(lineup.module)
                    .font(.numero(26))
                    .foregroundStyle(Palette.carta)
                CapsLabel(text: "modulo consigliato", color: Palette.carta.opacity(0.85), size: 9)
            }
            ForEach(["P", "D", "C", "A"], id: \.self) { role in
                if let line = lineup.startersByRole[role] {
                    HStack(spacing: 8) {
                        ForEach(line) { slot in playerPill(slot) }
                    }
                }
            }
        }
        .padding(.vertical, 18)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity)
        .background(Palette.pratoPieno)
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }

    private func playerPill(_ slot: LineupSlot) -> some View {
        VStack(spacing: 1) {
            Text(slot.player.name)
                .font(.nome(13))
                .lineLimit(1)
                .foregroundStyle(Palette.inchiostro)
            Text(slot.prob?.pct.map { "\(Int($0))%" } ?? "—")
                .font(.numero(9, weight: .regular))
                .foregroundStyle((slot.prob?.pct ?? 0) >= 100 ? Palette.campo : Palette.ocra)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(Palette.scheda)
        .clipShape(RoundedRectangle(cornerRadius: 3))
    }

    private func excludedSection(_ lineup: Lineup) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            CapsLabel(text: "Fuori causa", color: Palette.granata)
                .padding(.bottom, 5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(Rectangle().frame(height: 1).foregroundStyle(Palette.granata), alignment: .bottom)
            ForEach(lineup.excluded) { slot in
                HStack(spacing: 10) {
                    RoleBadge(role: slot.player.roleClassic, side: 20)
                    Text(slot.player.name).font(.nome(15)).foregroundStyle(Palette.inchiostro)
                    Spacer()
                    Text(slot.note ?? "").font(.numero(11, weight: .regular)).foregroundStyle(Palette.granata)
                }
                .padding(.vertical, 7)
                .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Palette.attenuato.opacity(0.4)), alignment: .bottom)
            }
        }
    }

    private func benchSection(_ lineup: Lineup) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            CapsLabel(text: "Panchina · in ordine di ingresso", color: Palette.inchiostro)
                .padding(.bottom, 5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(Rectangle().frame(height: 1).foregroundStyle(Palette.inchiostro), alignment: .bottom)
            ForEach(Array(lineup.bench.enumerated()), id: \.element.id) { index, slot in
                HStack(spacing: 10) {
                    Text("\(index + 1)")
                        .font(.numero(14))
                        .foregroundStyle(Palette.attenuato)
                        .frame(width: 18, alignment: .trailing)
                    Text(slot.player.name).font(.nome(16)).foregroundStyle(Palette.inchiostro)
                    Spacer()
                    Text("\(slot.player.roleClassic)\(slot.note.map { " · \($0)" } ?? "")")
                        .font(.numero(10, weight: .regular))
                        .foregroundStyle(Palette.attenuato)
                        .lineLimit(1)
                }
                .padding(.vertical, 7)
                .overlay(Rectangle().frame(height: 0.5).foregroundStyle(Palette.attenuato.opacity(0.4)), alignment: .bottom)
            }
        }
    }

    private func actions(_ lineup: Lineup) -> some View {
        VStack(spacing: 8) {
            if let url = URL(string: store.settings.leagueURL), !store.settings.leagueURL.isEmpty {
                Link(destination: url) {
                    Text("Apri la lega e schiera").frame(maxWidth: .infinity)
                }
                .buttonStyle(InkButtonStyle())
            }
            Button {
                UIPasteboard.general.string = lineup.shareText
                copied = true
            } label: {
                Text(copied ? "Copiata ✓" : "Copia la formazione")
            }
            .buttonStyle(InkButtonStyle(prominent: store.settings.leagueURL.isEmpty))
            Button {
                Task { await askClaude(lineup) }
            } label: {
                Text("Chiedi un parere a Claude")
            }
            .buttonStyle(InkButtonStyle(prominent: false))
            .disabled(claudeLoading)
        }
    }

    private func opinionBox(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            CapsLabel(text: "Il parere di Claude", color: Palette.campo, size: 10)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Palette.inchiostro)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(Rectangle().strokeBorder(Palette.campo, lineWidth: 1.5))
    }

    private func askClaude(_ lineup: Lineup) async {
        claudeLoading = true
        claudeError = nil
        defer { claudeLoading = false }
        do {
            claudeOpinion = try await ClaudeService.secondOpinion(
                lineup: lineup, giornata: nil, settings: store.settings
            )
        } catch {
            claudeError = error.localizedDescription
        }
    }
}
