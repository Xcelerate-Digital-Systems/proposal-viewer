// components/viewer/CoverPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Proposal, supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';

interface CoverPageProps {
  proposal: Proposal;
  branding: CompanyBranding;
  onStart: () => void;
}

/**
 * Convert a hex color to an rgba string for use in gradients / overlays.
 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CoverPage({ proposal, branding, onStart }: CoverPageProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch signed URL for cover image
  useEffect(() => {
    if (proposal.cover_image_path) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(proposal.cover_image_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setBgUrl(data.signedUrl);
        });
    }
  }, [proposal.cover_image_path]);

  // Wait for cover image to fully load before revealing, or fade in immediately if no image
  useEffect(() => {
    if (proposal.cover_image_path && !bgUrl) return; // Still fetching signed URL

    if (bgUrl) {
      const img = new Image();
      img.onload = () => setTimeout(() => setLoaded(true), 50);
      img.onerror = () => setTimeout(() => setLoaded(true), 50);
      img.src = bgUrl;
    } else {
      // No cover image — fade in after brief delay
      const timer = setTimeout(() => setLoaded(true), 100);
      return () => clearTimeout(timer);
    }
  }, [bgUrl, proposal.cover_image_path]);

  const subtitle = proposal.cover_subtitle || `Prepared for ${proposal.client_name}`;
  const buttonText = proposal.cover_button_text || 'START READING PROPOSAL';

  // Cover branding from company settings
  const bgStyle = branding.cover_bg_style || 'gradient';
  const bgColor1 = branding.cover_bg_color_1 || '#0f0f0f';
  const bgColor2 = branding.cover_bg_color_2 || '#141414';
  const textColor = branding.cover_text_color || '#ffffff';
  const subtitleColor = branding.cover_subtitle_color || '#ffffffb3';
  const btnBg = branding.cover_button_bg || '#ff6700';
  const btnText = branding.cover_button_text || '#ffffff';
  const overlayOpacity = branding.cover_overlay_opacity ?? 0.65;
  const gradientType = branding.cover_gradient_type || 'linear';
  const gradientAngle = branding.cover_gradient_angle ?? 135;

  // Build background: solid or gradient (linear / radial / conic)
  const baseBg = bgStyle === 'solid'
    ? bgColor1
    : undefined;

  function buildGradient(color1: string, color2: string): string {
    switch (gradientType) {
      case 'radial':
        return `radial-gradient(circle, ${color1}, ${color2})`;
      case 'conic':
        return `conic-gradient(from ${gradientAngle}deg, ${color1}, ${color2})`;
      default:
        return `linear-gradient(${gradientAngle}deg, ${color1}, ${color2})`;
    }
  }

  const baseBgImage = bgStyle === 'gradient'
    ? buildGradient(bgColor1, bgColor2)
    : undefined;

  // Build overlay for when a cover image is present
  const overlayEnd = overlayOpacity + 0.1 > 1 ? 1 : overlayOpacity + 0.1;
  const imageOverlay = bgStyle === 'solid'
    ? hexToRgba(bgColor1, overlayOpacity)
    : buildGradient(
        hexToRgba(bgColor1, overlayOpacity),
        hexToRgba(bgColor2, overlayEnd)
      );

  return (
    <div
      className={`h-screen w-screen flex flex-col justify-between relative overflow-hidden transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: bgColor1 }}
    >
      {/* Background: either uploaded image or the branding bg */}
      {bgUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: baseBg,
            backgroundImage: baseBgImage,
          }}
        />
      )}

      {/* Overlay — only needed when there's a background image */}
      {bgUrl && (
        <div
          className="absolute inset-0"
          style={{
            background: typeof imageOverlay === 'string' && imageOverlay.includes('-gradient(')
              ? imageOverlay
              : undefined,
            backgroundColor: typeof imageOverlay === 'string' && !imageOverlay.includes('-gradient(')
              ? imageOverlay
              : undefined,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full px-6 py-8 sm:px-10 sm:py-10 md:px-16 md:py-14">
        {/* Company logo / name */}
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.name}
              className="h-7 sm:h-8 md:h-10 max-w-[180px] object-contain"
            />
          ) : branding.name ? (
            <div className="flex items-center gap-2">
              <Building2 size={20} style={{ color: subtitleColor }} />
              <span className="text-sm md:text-base font-medium" style={{ color: textColor, opacity: 0.9 }}>
                {branding.name}
              </span>
            </div>
          ) : (
            <img src="/logo-white.svg" alt="Logo" className="h-6 sm:h-7 md:h-8 opacity-90" />
          )}
        </div>

        {/* Title area */}
        <div className="max-w-2xl">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight mb-3 sm:mb-4 font-[family-name:var(--font-display)]"
            style={{ color: textColor }}
          >
            {proposal.title}
          </h1>
          <p
            className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8"
            style={{ color: subtitleColor }}
          >
            {subtitle}
          </p>
          <button
            onClick={onStart}
            className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold tracking-wider uppercase rounded-sm transition-opacity"
            style={{ backgroundColor: btnBg, color: btnText }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {buttonText}
          </button>
        </div>

        {/* Bottom spacer */}
        <div />
      </div>
    </div>
  );
}