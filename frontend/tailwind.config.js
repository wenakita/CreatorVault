/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eagle: {
          gold: '#d4af37',
          'gold-dark': '#b8941f',
          'gold-darker': '#a0800d',
          'gold-darkest': '#8a6f00',
          'gold-light': '#e2c55f',
          'gold-lighter': '#edd577',
          'gold-lightest': '#f5e89f',
        },
        indigo: {
          DEFAULT: '#6366f1',
        },
        purple: {
          DEFAULT: '#8b5cf6',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
