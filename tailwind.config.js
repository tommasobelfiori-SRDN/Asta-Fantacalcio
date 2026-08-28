/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Palette "Almanacco": carta calda e inchiostro, con i colori maglia dei ruoli.
      colors: {
        paper: '#F6F1E6',
        card: '#FBF8F0',
        ink: '#23201A',
        muted: '#756D5E',
        campo: '#2F6B4B',
        azzurro: '#3D6A8C',
        ocra: '#B07F1B',
        granata: '#9E3B33',
      },
      borderColor: {
        hair: 'rgba(35,32,26,0.22)',
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
        press: '3px 3px 0 rgba(35,32,26,0.16)',
        card: '7px 7px 0 rgba(35,32,26,0.22)',
      },
    },
  },
  plugins: [],
}
