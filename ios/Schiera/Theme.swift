import SwiftUI

// Palette "Almanacco" — la stessa del sito e del file Figma, nei due temi.
// I font di sistema fanno le veci di quelli web: New York (serif) per i nomi,
// SF Mono per i numeri, SF per le etichette.
enum Palette {
    static let carta = dyn(light: (246, 241, 230), dark: (30, 26, 20))
    static let scheda = dyn(light: (251, 248, 240), dark: (39, 34, 27))
    static let inchiostro = dyn(light: (35, 32, 26), dark: (237, 231, 216))
    static let attenuato = dyn(light: (117, 109, 94), dark: (154, 145, 127))
    static let campo = dyn(light: (47, 107, 75), dark: (125, 174, 147))
    static let azzurro = dyn(light: (61, 106, 140), dark: (138, 177, 208))
    static let ocra = dyn(light: (176, 127, 27), dark: (216, 166, 63))
    static let granata = dyn(light: (158, 59, 51), dark: (210, 124, 112))

    /// Il campo da gioco resta verde pieno in entrambi i temi.
    static let pratoPieno = dyn(light: (47, 107, 75), dark: (38, 74, 55))

    static func roleColor(_ role: String) -> Color {
        switch role {
        case "P": return ocra
        case "D": return azzurro
        case "C": return campo
        default: return granata
        }
    }

    private static func dyn(light: (Int, Int, Int), dark: (Int, Int, Int)) -> Color {
        Color(UIColor { trait in
            let c = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat(c.0) / 255, green: CGFloat(c.1) / 255, blue: CGFloat(c.2) / 255, alpha: 1)
        })
    }
}

extension Font {
    /// Nomi dei calciatori e titoli: serif, come il Newsreader del sito.
    static func nome(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }

    /// Numeri incolonnabili: prezzi, percentuali, fantamedie.
    static func numero(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }

    /// Etichette maiuscolette.
    static func etichetta(_ size: CGFloat = 11) -> Font {
        .system(size: size, weight: .bold)
    }
}

/// Etichetta maiuscoletta in stile almanacco.
struct CapsLabel: View {
    let text: String
    var color: Color = Palette.attenuato
    var size: CGFloat = 11

    var body: some View {
        Text(text.uppercased())
            .font(.etichetta(size))
            .kerning(0.9)
            .foregroundStyle(color)
    }
}

/// Quadratino ruolo col colore maglia.
struct RoleBadge: View {
    let role: String
    var filled: Bool = false
    var side: CGFloat = 24

    var body: some View {
        Text(role)
            .font(.etichetta(side * 0.5))
            .foregroundStyle(filled ? Palette.carta : Palette.roleColor(role))
            .frame(width: side, height: side)
            .background(filled ? Palette.roleColor(role) : .clear)
            .overlay(Rectangle().strokeBorder(Palette.roleColor(role), lineWidth: 1.5))
    }
}

/// Bottone pieno d'inchiostro, con l'ombra "di stampa".
struct InkButtonStyle: ButtonStyle {
    var prominent = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.etichetta(12))
            .kerning(0.9)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(prominent ? Palette.inchiostro : .clear)
            .foregroundStyle(prominent ? Palette.carta : Palette.inchiostro)
            .overlay(Rectangle().strokeBorder(Palette.inchiostro, lineWidth: prominent ? 0 : 1.5))
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}
