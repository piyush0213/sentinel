/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: '#0A0A0F',
          secondary: '#111118',
          tertiary: '#1A1A24',
          elevated: '#22222E',
        },
        border: {
          DEFAULT: '#1E1E2A',
          light: '#2A2A3A',
          focus: 'rgba(0, 210, 106, 0.25)',
        },
        accent: {
          green: '#00D26A',
          red: '#FF3B3B',
          amber: '#FFB020',
          blue: '#3B82F6',
        },
        text: {
          primary: '#F0F0F5',
          secondary: '#8B8B9E',
          muted: '#5A5A6E',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 210, 106, 0.15)',
        'glow-red': '0 0 20px rgba(255, 59, 59, 0.15)',
        'glow-amber': '0 0 20px rgba(255, 176, 32, 0.15)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
