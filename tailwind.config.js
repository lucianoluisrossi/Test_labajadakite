/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app.js",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./api/**/*.{js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        // Colores personalizados para La Bajada
        'kite-blue': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        'wind-green': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        'spot-teal': {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        }
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      animation: {
        'wind-arrow': 'spin 0.5s ease-out',
        'gallery-pulse': 'pulse 2s ease-in-out infinite',
        'toast-slide-in': 'slideIn 0.3s ease-out',
        'toast-slide-out': 'slideOut 0.3s ease-in',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'bounce-gentle': 'bounceGentle 1s infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translate(-50%, -20px)', opacity: '0' },
          '100%': { transform: 'translate(-50%, 0)', opacity: '1' }
        },
        slideOut: {
          '0%': { transform: 'translate(-50%, 0)', opacity: '1' },
          '100%': { transform: 'translate(-50%, -20px)', opacity: '0' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        bounceGentle: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' }
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'wind-card': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'fab': '0 10px 25px rgba(0, 0, 0, 0.2)',
        'toast': '0 10px 25px rgba(34, 197, 94, 0.2)',
      },
      screens: {
        'xs': '475px',
      }
    },
  },
  plugins: [
    // Plugin para mejor tipografía
    function({ addUtilities }) {
      addUtilities({
        '.text-shadow': {
          'text-shadow': '0 1px 2px rgba(0, 0, 0, 0.1)',
        },
        '.text-shadow-md': {
          'text-shadow': '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
        '.text-shadow-lg': {
          'text-shadow': '0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)',
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': '#cbd5e1 #f1f5f9',
        },
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': {
            'display': 'none'
          }
        }
      })
    }
  ],
}