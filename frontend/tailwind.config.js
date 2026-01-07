/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5cbfde',
        dark: '#24272c',
        glass: {
          white: 'rgba(255, 255, 255, 0.1)',
          dark: 'rgba(36, 39, 44, 0.7)',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'glass-shine': 'glass-shine 3s ease-in-out infinite',
      },
      keyframes: {
        'glass-shine': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 },
        }
      }
    },
  },
  plugins: [],
}
