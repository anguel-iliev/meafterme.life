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
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary amber/gold — matches lovable --primary: 36 80% 55%
        primary: {
          DEFAULT: 'hsl(36 80% 55%)',
          foreground: 'hsl(30 15% 7%)',
          5:  'hsl(36 80% 55% / 0.05)',
          10: 'hsl(36 80% 55% / 0.10)',
          20: 'hsl(36 80% 55% / 0.20)',
          40: 'hsl(36 80% 55% / 0.40)',
          60: 'hsl(36 80% 55% / 0.60)',
        },
        // Background colors
        background: 'hsl(30 15% 7%)',
        foreground: 'hsl(38 50% 92%)',
        card: 'hsl(30 12% 11%)',
        muted: 'hsl(30 8% 14%)',
        'muted-foreground': 'hsl(30 15% 50%)',
        secondary: 'hsl(30 10% 16%)',
        'secondary-foreground': 'hsl(38 40% 80%)',
        border: 'hsl(30 10% 18%)',
        // Keep brand for backward compatibility with app pages
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
        // Amber glow
        amber: {
          glow: 'hsl(36 90% 60%)',
        },
        cream: 'hsl(38 50% 92%)',
        charcoal: 'hsl(30 15% 7%)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(180deg, hsl(30 15% 7%) 0%, hsl(30 12% 11%) 100%)',
        'card-gradient': 'linear-gradient(135deg, hsl(30 12% 11%) 0%, hsl(30 10% 14%) 100%)',
        'text-gradient': 'linear-gradient(135deg, hsl(36 80% 55%) 0%, hsl(38 50% 92%) 100%)',
      },
      boxShadow: {
        'glow': '0 0 60px -10px hsl(36 80% 55% / 0.2)',
        'card': '0 8px 32px -8px hsl(0 0% 0% / 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '1' },
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: 'calc(0.75rem - 2px)',
        sm: 'calc(0.75rem - 4px)',
      },
    },
  },
  plugins: [],
};
