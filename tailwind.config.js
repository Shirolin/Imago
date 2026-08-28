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
        sans: ['IBM Plex Sans', 'Noto Sans SC', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace']
      },
      colors: {
        room: 'var(--room)',
        chrome: 'var(--chrome)',
        well: 'var(--well)',
        ink: 'var(--ink)',
        'ink-well': 'var(--ink-well)',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'var(--room)',
        foreground: 'var(--ink)',
        primary: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--ink)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'var(--ink)'
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--ink)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted-hsl))',
          foreground: 'var(--muted)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--ink)'
        },
        popover: {
          DEFAULT: 'var(--chrome)',
          foreground: 'var(--ink)'
        },
        card: {
          DEFAULT: 'var(--chrome)',
          foreground: 'var(--ink)'
        },
        success: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--ink)'
        },
        warning: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--ink)'
        },
        info: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--ink)'
        }
      },
      borderRadius: {
        '3xl': 'var(--radius)',
        '2xl': 'var(--radius)',
        xl: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        DEFAULT: 'var(--radius)'
      },
      boxShadow: {
        soft: '0 1px 3px rgba(18, 21, 26, 0.22)',
        elevated: '0 1px 3px rgba(18, 21, 26, 0.22)',
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
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      transitionTimingFunction: {
        apple: 'ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/container-queries')]
}
