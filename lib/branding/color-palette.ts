// lib/branding/color-palette.ts
// Generates a full semantic palette from 3 brand inputs using OKLCH color math.

import {
  hexToOklch,
  oklchToHex,
  adjustLightness,
  setLightnessAndChroma,
  withAlpha,
} from './color-math';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BrandPalette = {
  // Accent-derived (from accent_color)
  accent: string;
  accentHover: string;
  accentActive: string;
  accentTint: string;
  accentMuted: string;
  accentBorder: string;
  accentSurface: string;

  // Background-derived (from bg_primary + bg_secondary)
  bg: string;
  bgElevated: string;
  bgCard: string;
  surface: string;
  border: string;
  borderSubtle: string;

  // Text shades (derived from background lightness)
  mutedText: string;
  faintText: string;

  // Pass-through
  sidebarText: string;
  acceptText: string;

  isDark: boolean;
};

// ─── Generator ──────────────────────────────────────────────────────────────

export function generateBrandPalette(
  accentHex: string,
  bgPrimaryHex: string,
  bgSecondaryHex: string,
  sidebarTextHex: string = '#ffffff',
  acceptTextHex: string = '#ffffff',
  bgDividerHex: string | null = null,
  sidebarInactiveTextHex: string | null = null,
): BrandPalette {
  const accent = accentHex || '#01434A';
  const bgPrimary = bgPrimaryHex || '#0f0f0f';
  const bgSecondary = bgSecondaryHex || '#141414';

  const accentLch = hexToOklch(accent);
  const bgPrimaryLch = hexToOklch(bgPrimary);
  const isDark = bgPrimaryLch.L < 0.5;
  const dir = isDark ? 1 : -1;

  // Accent shades via OKLCH lightness
  const accentHover = oklchToHex({
    ...accentLch,
    L: accentLch.L + dir * 0.08,
  });
  const accentActive = oklchToHex({
    ...accentLch,
    L: accentLch.L - dir * 0.04,
  });
  // Tint: very light (dark theme) or very dark (light theme) version
  const accentTint = isDark
    ? setLightnessAndChroma(accent, 0.93, Math.min(0.03, accentLch.C * 0.15))
    : setLightnessAndChroma(accent, 0.15, Math.min(0.03, accentLch.C * 0.15));

  // Opacity-based accent variants (composite on any background)
  const accentMuted = withAlpha(accent, 0.4);
  const accentBorder = withAlpha(accent, 0.19);
  const accentSurface = withAlpha(accent, 0.06);

  // Background shades via OKLCH lightness
  const bgElevated = adjustLightness(bgPrimary, dir * 0.025);
  const bgCard = adjustLightness(bgPrimary, dir * 0.045);
  const surface = adjustLightness(bgPrimary, dir * 0.035);
  const borderBase = bgDividerHex || bgSecondary;
  const border = bgDividerHex || adjustLightness(bgSecondary, dir * 0.08);
  const borderSubtle = bgDividerHex
    ? adjustLightness(bgDividerHex, dir * -0.03)
    : adjustLightness(bgSecondary, dir * 0.05);

  // Text shades — use explicit inactive colour when set, else derive from bg
  const mutedText = sidebarInactiveTextHex
    || (isDark ? adjustLightness(bgPrimary, 0.40) : adjustLightness(bgPrimary, -0.40));
  const faintText = sidebarInactiveTextHex
    ? withAlpha(sidebarInactiveTextHex, 0.6)
    : (isDark ? adjustLightness(bgPrimary, 0.28) : adjustLightness(bgPrimary, -0.28));

  return {
    accent,
    accentHover,
    accentActive,
    accentTint,
    accentMuted,
    accentBorder,
    accentSurface,
    bg: bgPrimary,
    bgElevated,
    bgCard,
    surface,
    border,
    borderSubtle,
    mutedText,
    faintText,
    sidebarText: sidebarTextHex || '#ffffff',
    acceptText: acceptTextHex || '#ffffff',
    isDark,
  };
}
