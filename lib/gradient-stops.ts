// lib/gradient-stops.ts
// Shared types + helpers for multi-stop gradients used by the cover splash and
// the quote-body header band. When `cover_gradient_stops` / `quote_header_gradient_stops`
// is NULL we fall back to the legacy two-colour bg_color_1/2 columns so old
// quotes keep rendering unchanged.

export interface GradientStop {
  color: string;
  /** 0-100 along the gradient axis. */
  position: number;
}

export type GradientType = 'linear' | 'radial' | 'conic';
export type BgStyle = 'gradient' | 'solid';

/** Parse a JSONB column value into a clean GradientStop[]. Tolerates malformed
 *  rows by returning an empty array — callers fall back to the legacy 2-colour
 *  shape in that case. */
export function parseStops(raw: unknown): GradientStop[] {
  if (!Array.isArray(raw)) return [];
  const out: GradientStop[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const c = (v as Record<string, unknown>).color;
    const p = (v as Record<string, unknown>).position;
    if (typeof c !== 'string') continue;
    const pos = typeof p === 'number' ? p : Number(p);
    if (!Number.isFinite(pos)) continue;
    out.push({ color: c, position: Math.max(0, Math.min(100, pos)) });
  }
  return out.sort((a, b) => a.position - b.position);
}

/** Resolve the stop list to use for rendering. Prefers the multi-stop array
 *  when it has at least 2 entries; otherwise builds a 2-stop list from the
 *  legacy column values. */
export function resolveStops(
  stopsRaw: unknown,
  fallbackColor1: string,
  fallbackColor2: string,
): GradientStop[] {
  const stops = parseStops(stopsRaw);
  if (stops.length >= 2) return stops;
  return [
    { color: fallbackColor1, position: 0 },
    { color: fallbackColor2, position: 100 },
  ];
}

/** Build a CSS background-image (or color) string for the given gradient
 *  config + resolved stops. Mirrors the renderers that lived inline inside
 *  HeaderStyleCard / CoverPage / QuoteSinglePageView before this module. */
export function buildGradientCss(
  style: BgStyle,
  type: GradientType,
  angle: number,
  cx: number,
  cy: number,
  stops: GradientStop[],
): string {
  if (style === 'solid' || stops.length === 0) {
    return stops[0]?.color ?? '#000000';
  }
  const list = stops.map((s) => `${s.color} ${s.position}%`).join(', ');
  switch (type) {
    case 'radial':
      return `radial-gradient(circle at ${cx}% ${cy}%, ${list})`;
    case 'conic':
      return `conic-gradient(from ${angle}deg at ${cx}% ${cy}%, ${list})`;
    case 'linear':
    default:
      return `linear-gradient(${angle}deg, ${list})`;
  }
}
