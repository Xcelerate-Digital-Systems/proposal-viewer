/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
      colors: {
        ink: '#1E2432',
        muted: '#8A8A8A',
        faint: '#ABABAB',
        edge: '#EFEFEF',
        'edge-hover': '#D5D5D5',
        surface: '#F5F4F2',
        ivory: '#FCFBF9',
        teal: {
          DEFAULT: '#017C87',
          hover: '#016670',
          tint: '#E6F5F3',
        },
      },
    },
  },
  plugins: [],
};
