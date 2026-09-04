import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Il backend "vero" durante lo sviluppo è l'emulatore Firebase Hosting su :5002
// (porta 5000 di default spesso occupata su macOS da AirPlay Receiver), che a sua
// volta inoltra /api/quotazioni alla Cloud Function (vedi firebase.json).
// Per lavorare solo sul frontend, senza emulatore, un file .env.<mode> può
// puntare API_PROXY_TARGET alla produzione (es. `vite --mode prodapi`).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:5002'
  return {
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  }
})
