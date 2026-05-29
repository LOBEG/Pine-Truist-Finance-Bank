/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pine: {
          50: '#f0f7f1',
          100: '#dceee0',
          200: '#b8ddc0',
          300: '#8fc89c',
          400: '#62af74',
          500: '#3f9657',
          600: '#2a7943',
          700: '#225f37',
          800: '#1b4b2c',
          900: '#143524',
        },
        gold: {
          400: '#e0b94a',
          500: '#c89b2a',
          600: '#a37f1d',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
