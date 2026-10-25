import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F8FA',
        surface: '#FFFFFF',
        ink: {
          50: '#F3F5F7',
          100: '#E7EAEE',
          200: '#D0D5DC',
          300: '#AAB2BC',
          400: '#7F8995',
          500: '#5F6975',
          600: '#4A535E',
          700: '#3B434D',
          800: '#2C333B',
          900: '#1E242B',
          950: '#12161B',
        },
        govt: {
          DEFAULT: '#1F4E79',
          soft: '#E8EFF6',
          dark: '#163A5A',
        },
        saffron: {
          DEFAULT: '#C9743A',
          soft: '#F7EDE5',
        },
        leaf: {
          DEFAULT: '#3E7C59',
          soft: '#E7F1EB',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(18 22 27 / 0.05), 0 1px 3px 0 rgb(18 22 27 / 0.04)',
        lift: '0 8px 24px -8px rgb(18 22 27 / 0.14)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
}
export default config
