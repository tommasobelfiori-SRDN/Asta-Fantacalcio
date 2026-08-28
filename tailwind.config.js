/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Palette "Almanacco" come variabili CSS (vedi index.css): la modalità
      // scura inverte carta e inchiostro senza toccare i componenti. Il formato
      // "R G B" consente i modificatori di opacità (es. bg-ink/40).
      colors: {
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        campo: 'rgb(var(--c-campo) / <alpha-value>)',
        azzurro: 'rgb(var(--c-azzurro) / <alpha-value>)',
        ocra: 'rgb(var(--c-ocra) / <alpha-value>)',
        granata: 'rgb(var(--c-granata) / <alpha-value>)',
      },
      borderColor: {
        hair: 'var(--c-hair)',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Archivo', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        caps: '0.09em',
      },
      boxShadow: {
        press: 'var(--shadow-press)',
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
}
