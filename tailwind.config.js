/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f766e',
          dark: '#0b5c57',
          light: '#14b8a6'
        }
      },
      borderRadius: {
        lg: '12px',
        xl: '16px'
      }
    },
  },
  plugins: [require('tailwindcss-animate')],
};
