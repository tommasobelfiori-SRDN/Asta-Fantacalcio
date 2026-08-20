import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Il backend "vero" durante lo sviluppo è l'emulatore Firebase Hosting su :5002
// (porta 5000 di default spesso occupata su macOS da AirPlay Receiver), che a sua
// volta inoltra /api/quotazioni alla Cloud Function (vedi firebase.json).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:5002',
    },
  },
})
