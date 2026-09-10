import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        sunk: 'var(--sunk)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        out: 'var(--out)',
        in: 'var(--in)',
        warn: 'var(--warn)',
        accent: 'var(--accent)',
      },
    },
  },
  plugins: [],
};

export default config;
