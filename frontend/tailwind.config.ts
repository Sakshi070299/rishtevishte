import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#C2185B', dark: '#9B1348', light: '#FFF0F5' },
        navy: { DEFAULT: '#1B2A4A', dark: '#0F1B33', light: '#2D4272' },
        gold: { DEFAULT: '#C5962C', light: '#F5E6B8', dark: '#A67B1E' },
        cream: { DEFAULT: '#FFFAF7', dark: '#FFF0E6' },
        temple: { brown: '#1B2A4A', 'brown-light': '#4A5568' },
        maroon: { DEFAULT: '#1B2A4A', dark: '#0F1B33', light: '#2D4272' },
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        hindi: ['Yatra One', 'Noto Sans Devanagari', 'serif'],
      },
      borderRadius: { xl: '20px' },
    },
  },
  plugins: [],
};

export default config;
