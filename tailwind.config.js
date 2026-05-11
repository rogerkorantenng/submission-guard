/**
 * Submission Guard — Professional dark theme for enterprise moderation tools.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          hover: '#1c2128',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          muted: '#6e7681',
        },
        accent: {
          orange: '#f0883e',
          red: '#da3633',
          yellow: '#d29922',
          purple: '#8957e5',
          blue: '#2f81f7',
          green: '#3fb950',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.5)',
        hover: '0 2px 6px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
