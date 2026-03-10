// components/viewer/ViewerBackground.tsx
'use client';

import { CompanyBranding } from '@/hooks/useProposal';

interface ViewerBackgroundProps {
  branding: CompanyBranding;
  className?: string;
}

/**
 * Renders a background image layer with color overlay behind viewer content.
 * If no bg_image_url is set, renders nothing (caller already sets solid bgColor).
 * 
 * Usage: place as the first child inside a `position: relative` container
 * that already has `backgroundColor: bgPrimary`.
 */
export default function ViewerBackground({ branding, className = '' }: ViewerBackgroundProps) {
  if (!branding.bg_image_url) return null;

  return (
    <>
      {/* Background image layer */}
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none ${className}`}
        style={{
          backgroundImage: `url(${branding.bg_image_url})`,
          filter: branding.bg_image_blur ? `blur(${branding.bg_image_blur}px)` : undefined,
          // Scale slightly to prevent blur-edge fringing
          transform: branding.bg_image_blur ? 'scale(1.05)' : undefined,
        }}
      />
      {/* Color overlay layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: branding.bg_primary || '#0f0f0f',
          opacity: branding.bg_image_overlay_opacity,
        }}
      />
    </>
  );
}