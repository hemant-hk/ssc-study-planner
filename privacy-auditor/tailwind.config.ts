import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAF9',
        surface: '#FFFFFF',
        ink: {
          50: '#F6F7F8',
          100: '#ECEEF0',
          200: '#D6DADE',
          300: '#B3BAC1',
          400: '#87919B',
          500: '#66717C',
          600: '#515B65',
          700: '#424A52',
          800: '#393F46',
          900: '#252A2F',
          950: '#171A1D',
        },
        accent: {
          DEFAULT: '#5B7A6B',
          soft: '#E7EDE9',
          muted: '#8FA89B',
        },
        risk: {
          low: '#6E8B74',
          medium: '#B4975A',
          high: '#B57658',
          critical: '#A9564E',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(23 26 29 / 0.04), 0 1px 3px 0 rgb(23 26 29 / 0.04)',
        lift: '0 4px 16px -4px rgb(23 26 29 / 0.10)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'score-fill': {
          '0%': { strokeDashoffset: 'var(--ring-size)' },
          '100%': { strokeDashoffset: 'var(--ring-offset)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
      },
    },
  },
  plugins: [],
}
export default config
