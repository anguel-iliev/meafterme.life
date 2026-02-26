/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dde6ff',
          200: '#c0d0ff',
          300: '#94afff',
          400: '#6080ff',
          500: '#3b5bfc',
          600: '#2541f0',
          700: '#1c31d9',
          800: '#1b2caf',
          900: '#1c2d8a',
          950: '#141c58',
        },
        warm: {
          50:  '#fdf8f0',
          100: '#faeedd',
          200: '#f4dabc',
          300: '#ebbf8f',
          400: '#e09a5a',
          500: '#d67d35',
          600: '#c66429',
          700: '#a44c23',
          800: '#843e24',
          900: '#6c3321',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
