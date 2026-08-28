import { createRequire } from 'module'
const require = createRequire(import.meta.url)

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './pages/**/*.{ts,tsx,vue}',
    './components/**/*.{ts,tsx,vue}',
    './app/**/*.{ts,tsx,vue}',
    './src/**/*.{ts,tsx,vue}'
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', 'sans-serif'],
        serif: ['Noto Serif SC', 'serif']
      },
      colors: {
        paper: 'var(--paper)',
        board: 'var(--board)',
        well: 'var(--well)',
        ink: 'var(--ink)',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'var(--paper)',
        foreground: 'var(--ink)',
        primary: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--board)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'var(--ink)'
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--board)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted-hsl))',
          foreground: 'var(--muted)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--board)'
        },
        popover: {
          DEFAULT: 'var(--board)',
          foreground: 'var(--ink)'
        },
        card: {
          DEFAULT: 'var(--board)',
          foreground: 'var(--ink)'
        },
        success: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--board)'
        },
        warning: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--ink)'
        },
        info: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--board)'
        }
      },
      borderRadius: {
        '3xl': 'var(--radius-well)',
        '2xl': 'var(--radius-well)',
        xl: 'var(--radius-ctrl)',
        lg: 'var(--radius-ctrl)',
        md: 'calc(var(--radius-ctrl) - 2px)',
        sm: 'calc(var(--radius-ctrl) - 4px)',
        DEFAULT: 'var(--radius-ctrl)'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(42, 38, 35, 0.06)',
        elevated: '0 1px 2px rgba(42, 38, 35, 0.06)',
        primary: 'none'
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        },
        'paper-settle': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'paper-settle': 'paper-settle 280ms ease-out'
      },
      transitionTimingFunction: {
        apple: 'ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/container-queries')]
}
