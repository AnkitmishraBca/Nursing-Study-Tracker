import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0d1a',
        panel: '#12172b',
        line: '#232b45',
        mint: '#34e0a1',
        violet: '#9b7bff',
        coral: '#ff6b8a',
        sun: '#ffc857',
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'Inter', 'system-ui', 'sans-serif'],
        script: ['Dancing Script', 'cursive'],
      },
      boxShadow: {
        glow: '0 0 40px -12px rgba(52, 224, 161, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
