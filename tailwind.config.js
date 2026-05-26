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
        // Semantic brand tokens — prefer these in new code.
        // `teal.*` above is kept as an alias for the ~thousands of existing
        // usages; new components should use the semantic names below so we
        // can re-skin the brand in one place later.
        primary: {
          DEFAULT: '#017C87',  // saturated teal — CTAs, links, focus rings, active states on light surfaces
          hover: '#016670',
          tint: '#E6F5F3',     // pale wash — selected-row bg, hover bg on light
        },
        // Dark-surface palette — the cluster the sidebar lives in. Use for
        // any dark-on-teal UI chrome (sidebar, dark modals, toolbars).
        'surface-dark': {
          DEFAULT: '#043946',  // primary dark surface (sidebar bg)
          border: '#01434A',   // dividers/borders on dark surface
          hover: '#013036',    // hover bg on dark surface
          accent: '#8AD9D1',   // bright text/icon accent on dark surface
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
