import Foundation
import UserNotifications

// Tre famiglie di notifiche, tutte locali (niente server di push da mantenere):
// 1. venerdì sera: promemoria "le probabili si sono assestate, dai un'occhiata"
// 2. sabato mattina: la formazione GIÀ NEL TESTO della notifica — il refresh in
//    background la tiene aggiornata, così anche senza aprire l'app sai chi schierare
// 3. immediate: un tuo giocatore ha cambiato stato (era ok, ora è infortunato)
enum NotificationManager {
    static let fridayId = "schiera.promemoria.venerdi"
    static let saturdayId = "schiera.formazione.sabato"

    static func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    /// Riprogramma le due notifiche settimanali. Va richiamata a ogni refresh:
    /// il corpo del sabato incorpora l'ultima formazione calcolata.
    static func scheduleWeekly(settings: AppSettings, lineup: Lineup?, giornata: String?) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [fridayId, saturdayId])

        let friday = UNMutableNotificationContent()
        friday.title = "Probabili assestate"
        friday.body = "Apri Schiera per vedere la formazione consigliata\(giornata.map { " della \($0)" } ?? "")."
        friday.sound = .default
        var fridayDate = DateComponents()
        fridayDate.weekday = 6 // venerdì
        fridayDate.hour = settings.fridayReminderHour
        fridayDate.minute = settings.fridayReminderMinute
        center.add(UNNotificationRequest(
            identifier: fridayId,
            content: friday,
            trigger: UNCalendarNotificationTrigger(dateMatching: fridayDate, repeats: true)
        ))

        let saturday = UNMutableNotificationContent()
        saturday.title = "La formazione è pronta"
        saturday.body = lineup?.shareText ?? "Apri Schiera: la formazione consigliata ti aspetta."
        saturday.sound = .default
        var saturdayDate = DateComponents()
        saturdayDate.weekday = 7 // sabato
        saturdayDate.hour = settings.saturdayLineupHour
        saturdayDate.minute = settings.saturdayLineupMinute
        center.add(UNNotificationRequest(
            identifier: saturdayId,
            content: saturday,
            trigger: UNCalendarNotificationTrigger(dateMatching: saturdayDate, repeats: true)
        ))
    }

    /// Allerta immediata: un giocatore della rosa è passato a uno stato peggiore.
    static func sendStatusAlert(playerName: String, tipo: String, nota: String?) {
        let content = UNMutableNotificationContent()
        content.title = "\(playerName) \(tipo)"
        content.body = nota ?? "Controlla la formazione: potrebbe servire un cambio."
        content.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(
            identifier: "schiera.status.\(playerName).\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil // subito
        ))
    }
}
