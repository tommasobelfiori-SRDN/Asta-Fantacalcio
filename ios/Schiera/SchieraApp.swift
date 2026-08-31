import SwiftUI

@main
struct SchieraApp: App {
    @StateObject private var store: AppStore

    init() {
        let store = AppStore()
        _store = StateObject(wrappedValue: store)
        AppStore.registerBackgroundTask(store: store)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .task {
                    _ = await NotificationManager.requestAuthorization()
                    await store.refresh()
                }
        }
    }
}
