/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Uniswap Pink (single accent)
        // Uses <alpha-value> so classes like `bg-uniswap/10` work.
        uniswap: 'rgb(255 0 122 / <alpha-value>)',
        // Creator Vaults Brand Kit (Glass Vault)
        // - Primary: Electric Blue (#0052FF)
        // - Surfaces: True black + deep charcoal
        brand: {
          // Named tokens (preferred)
          primary: '#0052FF',
          hover: '#004AD9',
          accent: '#3B82F6',
          glow: 'rgba(0, 82, 255, 0.15)',
          // Numeric scale (legacy; kept for existing UI)
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#3B82F6',
          500: '#0052FF',
          600: '#004AD9',
          700: '#0033CC',
          800: '#0029A3',
          900: '#001F7A',
          950: '#172554',
        },
        vault: {
          bg: '#020202', // True Black
          card: '#0A0A0A', // Deep Charcoal
          border: '#1F1F1F', // Fallback border
          text: '#EDEDED',
          subtext: '#666666',
        },
        // Surface colors - cool slate
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Technical palette from docs
        obsidian: {
          DEFAULT: '#0a0a0b',
          light: '#16161a',
          dark: '#050506',
        },
        basalt: {
          DEFAULT: '#16161a',
          light: '#2a2a32',
          dark: '#0a0a0b',
        },
        tension: {
          cyan: '#00f2ff',
          blue: '#0044ff',
        },
        copper: {
          dull: '#4a3321',
          bright: '#f59e0b',
        },
        magma: {
          mint: '#00ffa3',
        },
        signal: {
          cyan: '#06b6d4',
          pulse: '#22d3ee',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Space Mono', 'monospace'],
        serif: ['Playfair Display', 'ui-serif', 'Georgia', 'serif'],
        doto: ['Doto', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
        'scan': 'scan 4s linear infinite',
        // Used by the Liquid Gold UI (moves a highlight streak across)
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'tension-slide': 'tensionSlide 3s infinite linear',
        'sift-down': 'siftDown 3s infinite linear',
        'flow': 'flow 10s infinite linear',
        'pulse-ring': 'pulseRing 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 82, 255, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 82, 255, 0.6)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%) skewX(12deg)' },
          '100%': { transform: 'translateX(200%) skewX(12deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        tensionSlide: {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
        siftDown: {
          '0%': { transform: 'translateY(-150px) translateX(0)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(150px) translateX(20px)', opacity: '0' },
        },
        flow: {
          'from': { strokeDashoffset: '1000' },
          'to': { strokeDashoffset: '0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, var(--tw-gradient-stops))',
        'blue-gradient': 'linear-gradient(135deg, #0052FF 0%, #0033CC 100%)',
        'subtle-glow': 'radial-gradient(circle at 50% 0%, rgba(0, 82, 255, 0.05) 0%, transparent 70%)',
        'grain': 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23filter)\'/%3E%3C/svg%3E")',
        'wire-grid': 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'void': '0 20px 50px rgba(0,0,0,0.8)',
        'glow-cyan': '0 0 20px rgba(0, 242, 255, 0.4)',
        'glow-mint': '0 0 20px rgba(0, 255, 163, 0.4)',
        'glow-uniswap': '0 0 20px rgba(255, 0, 122, 0.35)',
      },
    },
  },
  plugins: [],
}
