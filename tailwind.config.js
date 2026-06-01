/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)'],
        display: ['var(--font-manrope)'],
        hand: ['var(--font-hand)', 'cursive'],
      },
      // Extends Tailwind's default fontSize scale with `2xs` (10px) for
      // tiny labels (badges, uppercase tracking-wider section headers).
      // Tailwind's smallest default is text-xs (12px); 10px is the most-used
      // badge size in this codebase and deserves a scale token instead of
      // 266 `text-[10px]` arbitrary-value usages.
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        'detail': ['11px', { lineHeight: '16px' }],
        'caption': ['13px', { lineHeight: '20px' }],
      },
      colors: {
        ink: '#1E2432',
        muted: '#8A8A8A',
        dim: '#6B7280',
        prose: '#4B5563',
        faint: '#ABABAB',
        edge: {
          DEFAULT: '#EFEFEF',
          hover: '#D5D5D5',
          strong: '#E5E7EB',
        },
        surface: '#F5F5F5',
        ivory: '#FFFFFF',
        paper: {
          DEFAULT: '#FAFAFA',
          dark: '#F1F1F1',
        },
        warm: {
          DEFAULT: '#FBF8F5',
          dark: '#F5F1EE',
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
          deep: '#01282e',     // dropdown/popover bg on dark surface
          accent: '#8AD9D1',   // bright text/icon accent on dark surface
        },
        // Section / feature accent palette — small set of complementary
        // colors used to color-code major dashboard sections or feature
        // areas so they're scannable at a glance. Same hex can appear in
        // multiple entries — the semantic name is what matters.
        accent: {
          feedback: {
            DEFAULT: '#9333EA',  // purple-600 — icon/text color
            tint: '#FAF5FF',     // purple-50  — swatch background
          },
          // AI / generation features — "Generate with AI" buttons, AI badges.
          // Currently same purple as feedback; split if we want them visually
          // distinct later.
          ai: {
            DEFAULT: '#9333EA',  // purple-600 — icon/text color
            tint: '#FAF5FF',     // purple-50  — button background
            'tint-hover': '#F3E8FF', // purple-100 — button hover
          },
        },
        // Status / mode indicators — short labels that flag a row or document
        // as being in a particular state (test/sandbox, archived, draft, etc.)
        // Distinct from accent.* (feature areas) and content-type.* (content
        // categorisation) because the meaning is "this thing is in <state>"
        // rather than "this thing belongs to <area>".
        status: {
          // Amber — for "sandbox / not live data" indicators. Amber reads as
          // 'be careful, this isn't real' more clearly than purple did.
          test: {
            DEFAULT: '#B45309', // amber-700 — fg (good contrast on amber-50)
            tint: '#FFFBEB',    // amber-50  — pill bg
            border: '#FDE68A',  // amber-200 — pill border
          },
        },
        // Content-type accent palette — used to color-code page/asset types
        // (pdf, text, pricing, packages) in pills and indicators. Each entry
        // is a tint bg + a darker fg, sampled from Tailwind's -50 / -400/-500.
        'content-type': {
          pdf: { DEFAULT: '#9CA3AF', tint: '#F3F4F6' },     // gray-400  / gray-100
          text: { DEFAULT: '#60A5FA', tint: '#EFF6FF' },    // blue-400  / blue-50
          pricing: { DEFAULT: '#22C55E', tint: '#F0FDF4' }, // green-500 / green-50
          packages: { DEFAULT: '#A855F7', tint: '#FAF5FF' },// purple-500 / purple-50
        },
      },
      keyframes: {
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        'progress-indeterminate': 'progress-indeterminate 1.4s ease-in-out infinite',
      },
      boxShadow: {
        sketch: '2px 3px 0 0 rgba(0,0,0,0.08)',
        'sketch-lg': '3px 5px 0 0 rgba(0,0,0,0.1)',
        // Card / surface shadow scale — replaces a tangle of arbitrary
        // `shadow-[...]` values that were spelled inline 50+ times. All four
        // use the same rgba(20,20,40, X) palette so cards sit in the same
        // shadow family; the difference is depth.
        card: '0 1px 2px rgba(20,20,40,0.04), 0 4px 16px rgba(20,20,40,0.04)',
        'card-soft': '0 1px 2px rgba(20,20,40,0.04), 0 2px 8px rgba(20,20,40,0.04)',
        'card-hover': '0 2px 4px rgba(20,20,40,0.06), 0 8px 20px rgba(20,20,40,0.06)',
        // Heavy lift for floating modals / dialogs.
        modal: '0 24px 48px rgba(20,20,40,0.18)',
        // 1px hairline under sticky headers — looks like a border but is a
        // shadow so it doesn't shift layout.
        divider: '0 1px 0 rgba(20,20,40,0.05)',
        // Popover / tooltip shadow — uses a cooler slate base for a slightly
        // more clinical look (matches dropdowns and floating UI).
        popover: '0 10px 40px -12px rgba(15,23,42,0.25), 0 4px 12px -4px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
};
