'use client';

import { memo } from 'react';
import { StepIcon, isFullColourBrand } from './FunnelStepNode';

/**
 * Small logo badge marking which system a node runs in.
 *
 * Distinct from the node's own icon: a "Qualified" pipeline stage keeps its
 * tick and gains a GoHighLevel badge, rather than having its meaning replaced
 * by the platform's logo.
 *
 * Sits bottom-right. The other three corners are taken — top-right is the
 * linked funnel/tab badge, top-left the role chip — and bottom-right stays
 * clear of the label underneath.
 *
 * White disc rather than the node's tint, so a brand mark reads against
 * whatever colour the node happens to be.
 *
 * Deliberately larger than the 20px linked-funnel badge beside it — a brand
 * mark needs the extra room to be recognisable, whereas that badge only has to
 * carry a single glyph.
 */
function PlatformBadge({
  slug, size = 32, offset = -4,
}: {
  slug: string;
  size?: number;
  /** Distance from the container's bottom-right corner. Negative overhangs the
   *  edge, which is right for a circle or card. Diamonds need a positive inset
   *  because their bottom-right corner is empty space — the shape's edge runs
   *  diagonally through the middle of it. */
  offset?: number;
}) {
  const isCustomLogo = /^https?:\/\//.test(slug);
  return (
    <div
      className="absolute rounded-full bg-white border border-ink/15 shadow-sm flex items-center justify-center overflow-hidden pointer-events-none z-10"
      style={{ width: size, height: size, bottom: offset, right: offset }}
      title={isCustomLogo ? 'Custom logo' : slug}
    >
      {/* A custom uploaded logo is stored as a URL rather than a catalogue
          slug, so it renders directly — no filter, no lookup, and it works
          unchanged in the public viewer. */}
      {isCustomLogo ? (
        <img src={slug} alt="" className="w-full h-full object-contain p-0.5" />
      ) : (
      /* Built-in brand marks are authored white-on-transparent for the coloured
         discs, so on this white badge they need flipping back to dark.
         Full-colour app icons (ghl, servicem8, …) opt out and fill instead. */
      <StepIcon
        slug={slug}
        size={Math.round(size * 0.66)}
        brandSize={Math.round(size * 0.66)}
        fillContainer={isFullColourBrand(slug)}
        onLightSurface
      />
      )}
    </div>
  );
}

export default memo(PlatformBadge);
