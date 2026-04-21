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
        display: ['var(--font-sans)'],
        hand: ['var(--font-hand)', 'cursive'],
      },
      colors: {
        ink: '#1E2432',
        muted: '#8A8A8A',
        faint: '#ABABAB',
        edge: '#EFEFEF',
        'edge-hover': '#D5D5D5',
        surface: '#F5F5F5',
        ivory: '#FFFFFF',
        paper: {
          DEFAULT: '#FAFAFA',
          dark: '#F1F1F1',
        },
        'sketch-ink': '#2B2B2B',
        sticky: {
          yellow: '#FFF4B8',
          pink: '#FFD6E0',
          blue: '#C8E4FF',
          green: '#D1F0C8',
        },
        teal: {
          DEFAULT: '#017C87',
          hover: '#016670',
          tint: '#E6F5F3',
        },
      },
      boxShadow: {
        sketch: '2px 3px 0 0 rgba(0,0,0,0.08)',
        'sketch-lg': '3px 5px 0 0 rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
