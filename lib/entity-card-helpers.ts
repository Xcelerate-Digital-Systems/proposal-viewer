// lib/entity-card-helpers.ts
// Small shared helpers used by the entity list cards (Proposal, Template,
// Document). Kept tiny on purpose — they're presentation-only.

export interface CoverStyle {
  enabled: boolean;
  imagePath: string | null;
  bgStyle: string | null;
  bgColor1: string | null;
  bgColor2: string | null;
  gradientType: string | null;
  gradientAngle: number | null;
  overlayOpacity: number | null;
  textColor: string | null;
  subtitleColor: string | null;
}

export function buildCoverBg(c: CoverStyle): { backgroundColor?: string; backgroundImage?: string } {
  const style = c.bgStyle || 'gradient';
  const c1 = c.bgColor1 || '#0f0f0f';
  const c2 = c.bgColor2 || '#141414';
  if (style === 'solid') return { backgroundColor: c1 };
  const type = c.gradientType || 'linear';
  const angle = c.gradientAngle ?? 135;
  if (type === 'radial') return { backgroundImage: `radial-gradient(circle, ${c1}, ${c2})` };
  if (type === 'conic') return { backgroundImage: `conic-gradient(from ${angle}deg, ${c1}, ${c2})` };
  return { backgroundImage: `linear-gradient(${angle}deg, ${c1}, ${c2})` };
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatSize(bytes: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Counts the "real" pages in an entity's page_names array — skipping group
 * (section header) entries. Works for both proposals and documents.
 */
export function pageCountFromPageNames(pageNames: unknown): number {
  if (!Array.isArray(pageNames)) return 0;
  return pageNames.filter((pn) =>
    typeof pn === 'string' || (typeof pn === 'object' && pn !== null && (pn as { type?: string }).type !== 'group')
  ).length;
}
