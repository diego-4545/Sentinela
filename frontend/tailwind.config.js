                                           
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        sentinela: {
          bg: '#12161c',
          panel: '#1a2029',
          border: '#2d313c',
          text: '#e6edf3',
          muted: '#8b949e',
          accent: '#4c8dff',
          error: '#f85149'
        }
      }
    },
  },
  plugins: [],
}