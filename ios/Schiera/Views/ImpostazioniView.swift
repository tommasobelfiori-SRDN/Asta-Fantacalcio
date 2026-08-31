import SwiftUI

struct ImpostazioniView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker(
                        "Promemoria venerdì",
                        selection: fridayBinding,
                        displayedComponents: .hourAndMinute
                    )
                    DatePicker(
                        "Formazione pronta sabato",
                        selection: saturdayBinding,
                        displayedComponents: .hourAndMinute
                    )
                    Toggle("Allerta infortuni ai miei", isOn: $store.settings.statusAlertsEnabled)
                } header: {
                    CapsLabel(text: "Notifiche", size: 10)
                } footer: {
                    Text("La notifica del sabato contiene la formazione già nel testo: la leggi dal polso o dalla schermata di blocco senza aprire l'app.")
                }

                Section {
                    TextField("https://leghe.fantacalcio.it/…", text: $store.settings.leagueURL)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                } header: {
                    CapsLabel(text: "La tua lega", size: 10)
                } footer: {
                    Text("Il link alla pagina formazioni della tua lega: dalla notifica ci arrivi con un tocco e la ricopi in mezzo minuto.")
                }

                Section {
                    SecureField("sk-ant-…", text: $store.settings.claudeAPIKey)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                    TextField("Modello", text: $store.settings.claudeModel)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                } header: {
                    CapsLabel(text: "Claude", size: 10)
                } footer: {
                    Text("Con la chiave, il bottone \"Chiedi un parere\" fa rileggere la formazione a Claude. Senza, l'app funziona comunque col motore deterministico.")
                }

                Section {
                    Button("Aggiorna i dati adesso") {
                        Task { await store.refresh() }
                    }
                    if let sync = store.lastSync {
                        LabeledContent("Ultimo aggiornamento") {
                            Text(sync.formatted(date: .abbreviated, time: .shortened))
                                .font(.numero(13, weight: .regular))
                        }
                    }
                } header: {
                    CapsLabel(text: "Dati", size: 10)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Palette.carta)
            .navigationTitle("Impostazioni")
            .onChange(of: store.settings.fridayReminderHour) { rescheduleNotifications() }
            .onChange(of: store.settings.saturdayLineupHour) { rescheduleNotifications() }
            .onChange(of: store.settings.fridayReminderMinute) { rescheduleNotifications() }
            .onChange(of: store.settings.saturdayLineupMinute) { rescheduleNotifications() }
        }
    }

    private func rescheduleNotifications() {
        NotificationManager.scheduleWeekly(settings: store.settings, lineup: store.lineup, giornata: nil)
    }

    private var fridayBinding: Binding<Date> {
        timeBinding(hour: $store.settings.fridayReminderHour, minute: $store.settings.fridayReminderMinute)
    }

    private var saturdayBinding: Binding<Date> {
        timeBinding(hour: $store.settings.saturdayLineupHour, minute: $store.settings.saturdayLineupMinute)
    }

    private func timeBinding(hour: Binding<Int>, minute: Binding<Int>) -> Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(
                    from: DateComponents(hour: hour.wrappedValue, minute: minute.wrappedValue)
                ) ?? Date()
            },
            set: { date in
                let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
                hour.wrappedValue = parts.hour ?? 12
                minute.wrappedValue = parts.minute ?? 0
            }
        )
    }
}
