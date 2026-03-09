import { createRequire } from 'module'
const require = createRequire(import.meta.url)

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    './pages/**/*.{ts,tsx,vue}',
    './components/**/*.{ts,tsx,vue}',
    './app/**/*.{ts,tsx,vue}',
    './src/**/*.{ts,tsx,vue}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
      },
      colors: {
        border: "hsla(173, 20%, 50%, 0.2)",
        input: "hsla(173, 20%, 50%, 0.2)",
        ring: "hsl(173, 80%, 40%)",
        // 品牌化中性色：为背景注入极微量的绿色偏移 (173色相)
        background: "hsl(173, 10%, 4%)", 
        foreground: "hsl(173, 5%, 98%)",
        primary: {
          DEFAULT: "hsl(173, 80%, 40%)",
          foreground: "hsl(173, 5%, 98%)",
        },
        secondary: {
          DEFAULT: "hsl(173, 15%, 15%)",
          foreground: "hsl(173, 5%, 98%)",
        },
        destructive: {
          DEFAULT: "hsl(0, 84%, 60%)",
          foreground: "hsl(0, 0%, 98%)",
        },
        muted: {
          DEFAULT: "hsl(173, 10%, 12%)",
          foreground: "hsl(173, 5%, 75%)",
        },
        accent: {
          DEFAULT: "hsl(173, 80%, 40%)",
          foreground: "hsl(173, 5%, 98%)",
        },
        popover: {
          DEFAULT: "hsl(173, 15%, 7%)",
          foreground: "hsl(173, 5%, 98%)",
        },
        card: {
          DEFAULT: "hsl(173, 15%, 8%)",
          foreground: "hsl(173, 5%, 98%)",
        },
        success: {
          DEFAULT: "hsl(142, 70%, 45%)",
          foreground: "white",
        },
        warning: {
          DEFAULT: "hsl(38, 92%, 50%)",
          foreground: "hsl(38, 92%, 10%)",
        },
        info: {
          DEFAULT: "hsl(210, 100%, 50%)",
          foreground: "white",
        }
      },
      borderRadius: {
        "2xl": "1.25rem",
        xl: "1rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'primary': '0 10px 15px -3px hsla(var(--primary) / 0.15), 0 4px 6px -2px hsla(var(--primary) / 0.1)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

