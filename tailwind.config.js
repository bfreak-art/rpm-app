/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#101E33', soft: '#22334D', mute: '#5A6B85' },
        paper: { DEFAULT: '#F7F5F0', card: '#FFFFFF', dark: '#0C1626', darkcard: '#16233A' },
        signal: { DEFAULT: '#E8563F', soft: '#FBE9E4' },
        zone: { DEFAULT: '#2E7D6B', soft: '#E3F1ED' }
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: { card: '0 1px 3px rgba(16,30,51,.08), 0 4px 14px rgba(16,30,51,.05)' }
    }
  },
  plugins: []
}
