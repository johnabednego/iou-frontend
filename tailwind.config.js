/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      keyframes: {
        spinGradient: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'spin-gradient': 'spinGradient 6s linear infinite', // Adjust 6s -> slower or faster
      },
      colors: {
        brand: {
          50: '#f6fbff',
          100: '#eef7ff',
          200: '#d9e9ff',
          300: '#b6d4ff',
          400: '#7fb8ff',
          500: '#4a90ff',
          600: '#2f7ef6',
          700: '#2466d6',
          800: '#1d4ea8',
          900: '#10306c'
        }
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg,#f0f4ff 0%,#d9e2ff 50%,#eaf7ff 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))',
        'backgroundImage': "url('src/assets/backgroundImage.png')"
      },
      boxShadow: {
        'soft-lg': '0 10px 30px rgba(16,24,40,0.08)',
        'main': '0px 4px 4px rgba(0, 0, 0, 0.25)',
      },
      borderRadius: {
        'xl-2': '20px'
      }
    }
  },
  plugins: []
}
