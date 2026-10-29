/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1677F3',
          hover: '#0755D9',
          navy: '#102A56',
          bg: '#F5F8FC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1677F3',
          600: '#0755D9',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#102A56',
        },
        navy: {
          DEFAULT: '#102A56',
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#829AB1',
          500: '#627D98',
          600: '#486581',
          700: '#334E68',
          800: '#243B53',
          900: '#102A56',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(16, 42, 86, 0.05), 0 1px 2px 0 rgba(16, 42, 86, 0.03)',
        'card': '0 4px 6px -1px rgba(16, 42, 86, 0.05), 0 2px 4px -1px rgba(16, 42, 86, 0.03)',
        'elevated': '0 10px 15px -3px rgba(16, 42, 86, 0.08), 0 4px 6px -2px rgba(16, 42, 86, 0.04)',
      },
    },
  },
  plugins: [],
}
