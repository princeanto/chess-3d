import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        raised: 'var(--raised)',
        line: 'var(--line)',
        brass: 'var(--brass)',
        jade: 'var(--jade)',
        crimson: 'var(--crimson)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        ui: ['var(--font-ui)', 'ui-sans-serif', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
