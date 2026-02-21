// lib/google-fonts.ts

export interface FontOption {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  weights?: string[]; // defaults to ['400','500','600','700']
}

/**
 * Curated list of ~100 Google Fonts suitable for professional proposals.
 * All confirmed available on Google Fonts. Grouped by category.
 */
export const GOOGLE_FONTS: FontOption[] = [
  // ── Sans-Serif ─────────────────────────────────────────
  { family: 'Inter', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif' },
  { family: 'Outfit', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Space Grotesk', category: 'sans-serif' },
  { family: 'Sora', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Nunito Sans', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'Rubik', category: 'sans-serif' },
  { family: 'Barlow', category: 'sans-serif' },
  { family: 'Figtree', category: 'sans-serif' },
  { family: 'Albert Sans', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Roboto Flex', category: 'sans-serif' },
  { family: 'Noto Sans', category: 'sans-serif' },
  { family: 'Source Sans 3', category: 'sans-serif' },
  { family: 'IBM Plex Sans', category: 'sans-serif' },
  { family: 'Mulish', category: 'sans-serif' },
  { family: 'Karla', category: 'sans-serif' },
  { family: 'Cabin', category: 'sans-serif' },
  { family: 'Quicksand', category: 'sans-serif' },
  { family: 'Josefin Sans', category: 'sans-serif' },
  { family: 'Archivo', category: 'sans-serif' },
  { family: 'Red Hat Display', category: 'sans-serif' },
  { family: 'Red Hat Text', category: 'sans-serif' },
  { family: 'Lexend', category: 'sans-serif' },
  { family: 'Urbanist', category: 'sans-serif' },
  { family: 'Overpass', category: 'sans-serif' },
  { family: 'Jost', category: 'sans-serif' },
  { family: 'Exo 2', category: 'sans-serif' },
  { family: 'Titillium Web', category: 'sans-serif' },
  { family: 'Catamaran', category: 'sans-serif' },
  { family: 'Libre Franklin', category: 'sans-serif' },
  { family: 'Signika', category: 'sans-serif' },
  { family: 'Epilogue', category: 'sans-serif' },
  { family: 'Hanken Grotesk', category: 'sans-serif' },
  { family: 'Onest', category: 'sans-serif' },
  { family: 'Geist', category: 'sans-serif' },
  { family: 'Instrument Sans', category: 'sans-serif' },
  { family: 'Wix Madefor Display', category: 'sans-serif' },
  { family: 'Afacad', category: 'sans-serif' },
  { family: 'Schibsted Grotesk', category: 'sans-serif' },
  { family: 'Commissioner', category: 'sans-serif' },
  { family: 'Atkinson Hyperlegible', category: 'sans-serif' },

  // ── Serif ──────────────────────────────────────────────
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'DM Serif Display', category: 'serif', weights: ['400'] },
  { family: 'DM Serif Text', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'Fraunces', category: 'serif' },
  { family: 'Newsreader', category: 'serif' },
  { family: 'Noto Serif', category: 'serif' },
  { family: 'IBM Plex Serif', category: 'serif' },
  { family: 'Roboto Slab', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Bitter', category: 'serif' },
  { family: 'Spectral', category: 'serif' },
  { family: 'Cardo', category: 'serif', weights: ['400', '700'] },
  { family: 'Vollkorn', category: 'serif' },
  { family: 'Literata', category: 'serif' },
  { family: 'Brygada 1918', category: 'serif' },
  { family: 'Petrona', category: 'serif' },
  { family: 'Instrument Serif', category: 'serif', weights: ['400'] },
  { family: 'Young Serif', category: 'serif', weights: ['400'] },

  // ── Display ────────────────────────────────────────────
  { family: 'Unbounded', category: 'display' },
  { family: 'Bricolage Grotesque', category: 'display' },
  { family: 'Bebas Neue', category: 'display', weights: ['400'] },
  { family: 'Oswald', category: 'display' },
  { family: 'Righteous', category: 'display', weights: ['400'] },
  { family: 'Archivo Black', category: 'display', weights: ['400'] },
  { family: 'Anton', category: 'display', weights: ['400'] },
  { family: 'Abril Fatface', category: 'display', weights: ['400'] },
  { family: 'Passion One', category: 'display', weights: ['400', '700'] },
  { family: 'Monoton', category: 'display', weights: ['400'] },
  { family: 'Big Shoulders Display', category: 'display' },
  { family: 'Syne', category: 'display' },
  { family: 'Gloock', category: 'display', weights: ['400'] },
  { family: 'Familjen Grotesk', category: 'display' },

  // ── Monospace ──────────────────────────────────────────
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'IBM Plex Mono', category: 'monospace' },
  { family: 'Space Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
];

/**
 * Build a Google Fonts URL for a set of font families.
 * Returns null if no fonts specified.
 */
export function buildGoogleFontsUrl(fonts: (string | null | undefined)[]): string | null {
  const unique = Array.from(new Set(fonts.filter(Boolean))) as string[];
  if (unique.length === 0) return null;

  const families = unique.map((family) => {
    const font = GOOGLE_FONTS.find((f) => f.family === family);
    const weights = font?.weights || ['400', '500', '600', '700'];
    return `family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}`;
  });

  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

/**
 * Get the CSS font-family string with fallbacks.
 */
export function fontFamily(font: string | null | undefined, fallback: string = 'inherit'): string {
  if (!font) return fallback;
  return `'${font}', ${fallback}`;
}