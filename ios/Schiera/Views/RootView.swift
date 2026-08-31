import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            FormazioneView()
                .tabItem { Label("Formazione", systemImage: "sportscourt") }
            RosaView()
                .tabItem { Label("Rosa", systemImage: "person.3") }
            ImpostazioniView()
                .tabItem { Label("Impostazioni", systemImage: "gearshape") }
        }
        .tint(Palette.inchiostro)
        .background(Palette.carta)
    }
}
