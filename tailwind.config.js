/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // shadcn CSS-variable tokens
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // project-specific design tokens — mode-adaptive via CSS variables
        vsc: {
          // Plain CSS variables (not used with opacity modifiers)
          bg: 'var(--vsc-bg)',
          sidebar: 'var(--vsc-sidebar)',
          panel: 'var(--vsc-panel)',
          active: 'var(--vsc-active)',
          text: 'var(--vsc-text)',
          muted: 'var(--vsc-muted)',
          dim: 'var(--vsc-dim)',
          warning: 'var(--vsc-warning)',
          blue: 'var(--vsc-blue)',
          code: 'var(--vsc-code)',
          'accent-light': 'var(--vsc-accent-light)',
          'accent-hover': 'var(--vsc-accent-hover)',
          'danger-light': 'var(--vsc-danger-light)',
          // RGB channel format — supports Tailwind opacity modifiers (/10, /30, etc.)
          accent: 'rgb(var(--vsc-accent-rgb) / <alpha-value>)',
          border: 'rgb(var(--vsc-border-rgb) / <alpha-value>)',
          danger: 'rgb(var(--vsc-danger-rgb) / <alpha-value>)',
          hover: 'rgb(var(--vsc-hover-rgb) / <alpha-value>)',
          success: 'rgb(var(--vsc-success-rgb) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['22px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.09), 0 8px 10px -6px rgb(0 0 0 / 0.09)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.2)',
      },
    },
  },
  plugins: [],
}
