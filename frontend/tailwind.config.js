/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        obsidian: {
          50:  '#f2f2f3',
          100: '#e4e4e7',
          200: '#c8c8ce',
          300: '#a8a8b3',
          400: '#7e7e8e',
          500: '#5c5c6d',
          600: '#3e3e4d',
          700: '#2a2a38',
          800: '#1a1a25',
          900: '#0f0f18',
          950: '#08080f',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        rose: {
          400: '#fb7185',
          500: '#f43f5e',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        sky: {
          400: '#38bdf8',
          500: '#0ea5e9',
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5)',
        'glow-emerald': '0 0 20px rgba(16,185,129,0.25)',
        'glow-rose': '0 0 20px rgba(244,63,94,0.25)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      keyframes: {
        'logo-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-3px)' },
        },
        'logo-glow': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.9)' },
          '50%':      { opacity: '0.7', transform: 'scale(1.15)' },
        },
      },
      animation: {
        'logo-float': 'logo-float 3s ease-in-out infinite',
        'logo-glow':  'logo-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
