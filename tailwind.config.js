/**
 * Submission Guard — visual identity inspired by old typewritten manuscripts
 * and dim editing studios. Cream paper, ink-dark text, amber editorial accents.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#fbf8f1',
          100: '#f3ecdb',
          200: '#e3d6b1',
          300: '#cbb47a',
        },
        ink: {
          400: '#5a4f44',
          600: '#332a23',
          700: '#221b16',
          800: '#13100c',
        },
        amber: {
          400: '#d8a233',
          500: '#b78019',
          600: '#8a5d10',
        },
        crimson: {
          400: '#bf4c3a',
          500: '#9d3424',
        },
        sage: {
          500: '#5d8159',
          600: '#48653f',
        },
      },
      fontFamily: {
        display: ['"Crimson Pro"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        page: '0 1px 2px rgba(34,27,22,0.06), 0 8px 20px rgba(34,27,22,0.06)',
      },
    },
  },
  plugins: [],
};
