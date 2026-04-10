/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vsc: {
          bg: '#0c0f0c',
          sidebar: '#101410',
          panel: '#141914',
          hover: '#191f19',
          active: '#1f2a1f',
          border: '#253028',
          text: '#beccbe',
          muted: '#5e7560',
          dim: '#3a4a3c',
          accent: '#c89820',
          'accent-light': 'rgba(200,152,32,0.12)',
          'accent-hover': '#b58818',
          danger: '#e05252',
          'danger-light': 'rgba(224,82,82,0.10)',
          success: '#5db87c',
          warning: '#d4900a',
          blue: '#6898cc',
          code: '#080a08',
        },
      },
      fontFamily: {
        mono: ['Martian Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'none': '0',
        'sm': '1px',
        DEFAULT: '2px',
        'md': '3px',
        'lg': '4px',
        'xl': '6px',
        '2xl': '8px',
        'full': '9999px',
      },
    },
  },
  plugins: [],
}
