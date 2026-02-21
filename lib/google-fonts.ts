// lib/google-fonts.ts

export interface FontOption {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  weights?: string[]; // defaults to ['400','700']
}

/**
 * Curated list of Google Fonts suitable for professional proposals.
 * Grouped by category for the picker UI.
 */
export const GOOGLE_FONTS: FontOption[] = [
  // Sans-Serif
  { family: 'Inter', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif' },
  { family: 'Outfit', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Space Grotesk', category: 'sans-serif' },
  { family: 'Sora', category: 'sans-serif' },
  { family: 'General Sans', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'Rubik', category: 'sans-serif' },
  { family: 'Barlow', category: 'sans-serif' },
  { family: 'Figtree', category: 'sans-serif' },
  { family: 'Albert Sans', category: 'sans-serif' },
  { family: 'Geist', category: 'sans-serif' },

  // Serif
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'DM Serif Display', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'Fraunces', category: 'serif' },
  { family: 'Newsreader', category: 'serif' },

  // Display
  { family: 'Unbounded', category: 'display' },
  { family: 'Clash Display', category: 'display' },
  { family: 'Cabinet Grotesk', category: 'display' },
  { family: 'Bricolage Grotesque', category: 'display' },
  { family: 'Instrument Serif', category: 'display' },
  { family: 'Bebas Neue', category: 'display', weights: ['400'] },
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