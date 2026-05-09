import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#E8651A', dark: '#C44E0A', light: '#FFF3EB' },
        maroon: { DEFAULT: '#8B1A1A', dark: '#5a0f0f', light: '#B33A3A' },
        gold: { DEFAULT: '#D4A017', light: '#F5E6B8' },
        cream: { DEFAULT: '#FFFAF5', dark: '#FFF0E0' },
        temple: { brown: '#3D1F0B', 'brown-light': '#6B3A1F' },
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
