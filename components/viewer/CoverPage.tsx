// components/viewer/CoverPage.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Proposal, supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';
import { buildGradientCss, resolveStops } from '@/lib/gradient-stops';

interface CoverPageProps {
  proposal: Proposal;
  branding: CompanyBranding;
  onStart: () => void;
  /** Hide the CTA button (used for PDF export capture) */
  hideButton?: boolean;
  /** Pre-resolved cover image URL (bypasses async fetch for export) */
  resolvedBgUrl?: string | null;
  /** Pre-resolved client logo URL (bypasses async fetch for export) */
  resolvedClientLogoUrl?: string | null;
  /** Pre-resolved avatar URL (bypasses async fetch for export) */
  resolvedAvatarUrl?: string | null;
  /** Pre-resolved prepared-by name (bypasses async member lookup for export) */
  resolvedPreparedByName?: string | null;
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

export default function CoverPage({
  proposal,
  branding,
  onStart,
  hideButton,
  resolvedBgUrl,
  resolvedClientLogoUrl,
  resolvedAvatarUrl,
  resolvedPreparedByName,
}: CoverPageProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(resolvedBgUrl ?? null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(resolvedClientLogoUrl ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(resolvedAvatarUrl ?? null);
  const [loaded, setLoaded] = useState(!!hideButton); // Skip fade-in for export
  const [exiting, setExiting] = useState(false);

  const COVER_FADE_MS = 700;
  const handleStart = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onStart, COVER_FADE_MS);
  };

  // Resolved member data (from prepared_by_member_id when direct fields are absent)
  const [resolvedName, setResolvedName] = useState<string | null>(resolvedPreparedByName ?? null);

  // Fetch signed URL for cover image (skip if pre-resolved)
  useEffect(() => {
    if (resolvedBgUrl !== undefined) return;
    if (!proposal.cover_image_path) return;

    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(proposal.cover_image_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data?.signedUrl) {
          setBgUrl(data.signedUrl);
        } else if (error) {
          // Reveal the cover anyway — falls back to the solid/gradient bg.
          setBgUrl('');
        }
      })
      .catch(() => {
        if (!cancelled) setBgUrl('');
      });

    return () => { cancelled = true; };
  }, [proposal.cover_image_path, resolvedBgUrl]);

  // Fetch client logo via member-badge API → base64 data URL (avoids ERR_BLOCKED_BY_ORB)
  useEffect(() => {
    if (resolvedClientLogoUrl !== undefined) return;
    if (proposal.cover_client_logo_path && proposal.cover_show_client_logo) {
      fetch(`/api/member-badge?path=${encodeURIComponent(proposal.cover_client_logo_path)}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.avatar_url) setClientLogoUrl(data.avatar_url); });
    }
  }, [proposal.cover_client_logo_path, proposal.cover_show_client_logo, resolvedClientLogoUrl]);

  // Fetch avatar via member-badge API → base64 data URL (avoids ERR_BLOCKED_BY_ORB)
  useEffect(() => {
    if (resolvedAvatarUrl !== undefined) return;
    if (proposal.cover_avatar_path && proposal.cover_show_avatar) {
      fetch(`/api/member-badge?path=${encodeURIComponent(proposal.cover_avatar_path)}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    }
  }, [proposal.cover_avatar_path, proposal.cover_show_avatar, resolvedAvatarUrl]);

  // Resolve prepared_by_member_id → name + avatar when direct fields are absent
  // (skip if pre-resolved)
  useEffect(() => {
    if (resolvedPreparedByName !== undefined) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberId = (proposal as any).prepared_by_member_id;
    if (!memberId) return;

    // Only resolve if we're missing the name or the avatar
    const needsName = !proposal.prepared_by;
    const needsAvatar = !proposal.cover_avatar_path && proposal.cover_show_avatar;
    if (!needsName && !needsAvatar) return;

    const resolve = async () => {
      const res = await fetch(`/api/member-badge?member_id=${memberId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (needsName && data.name) setResolvedName(data.name);
      if (needsAvatar && data.avatar_url) setAvatarUrl(data.avatar_url);
    };
    resolve();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(proposal as any).prepared_by_member_id, proposal.prepared_by, proposal.cover_avatar_path, proposal.cover_show_avatar, resolvedPreparedByName]);

  // Wait for cover image to fully load before revealing. Always reveal after
  // a max wait — a stalled signed-URL fetch or slow image must never trap the
  // cover at opacity-0 (which would render as a blank/white screen).
  useEffect(() => {
    if (hideButton) return; // Export mode — already visible

    const MAX_WAIT_MS = 1500;
    const fallbackTimer = setTimeout(() => setLoaded(true), MAX_WAIT_MS);

    if (bgUrl) {
      const img = new Image();
      const reveal = () => {
        clearTimeout(fallbackTimer);
        setTimeout(() => setLoaded(true), 50);
      };
      img.onload = reveal;
      img.onerror = reveal;
      img.src = bgUrl;
    } else if (!proposal.cover_image_path) {
      clearTimeout(fallbackTimer);
      const timer = setTimeout(() => setLoaded(true), 100);
      return () => clearTimeout(timer);
    }

    return () => clearTimeout(fallbackTimer);
  }, [bgUrl, proposal.cover_image_path, hideButton]);

  const subtitle = proposal.cover_subtitle || `Prepared for ${proposal.client_name}`;
  const buttonText = proposal.cover_button_text || 'START READING PROPOSAL';

  // Cover colors: read from proposal first, fall back to company branding
  const bgStyle = proposal.cover_bg_style || branding.cover_bg_style || 'gradient';
  const bgColor1 = proposal.cover_bg_color_1 || branding.cover_bg_color_1 || '#0f0f0f';
  const bgColor2 = proposal.cover_bg_color_2 || branding.cover_bg_color_2 || '#141414';
  const textColor = proposal.cover_text_color || branding.cover_text_color || '#ffffff';
  const subtitleColor = proposal.cover_subtitle_color || branding.cover_subtitle_color || '#ffffffb3';
  const btnBg = proposal.cover_button_bg || branding.cover_button_bg || '#01434A';
  const btnText = proposal.cover_button_text_color || branding.cover_button_text || '#ffffff';
  const overlayOpacity = proposal.cover_overlay_opacity ?? branding.cover_overlay_opacity ?? 0.65;
  const gradientType = (proposal.cover_gradient_type || branding.cover_gradient_type || 'linear') as 'linear' | 'radial' | 'conic';
  const gradientAngle = proposal.cover_gradient_angle ?? branding.cover_gradient_angle ?? 135;
  const gradientCx = (proposal.cover_gradient_position_x ?? 50) as number;
  const gradientCy = (proposal.cover_gradient_position_y ?? 50) as number;
  const gradientStops = resolveStops(proposal.cover_gradient_stops, bgColor1, bgColor2);

  // Visibility flags (default true for prepared_by for backward compat)
  const showPreparedBy = proposal.cover_show_prepared_by ?? true;
  const showDate = proposal.cover_show_date ?? false;
  const showClientLogo = proposal.cover_show_client_logo ?? false;
  const showAvatar = proposal.cover_show_avatar ?? false;

  // Use resolved name as fallback when proposal.prepared_by is not set
  const preparedByName = proposal.prepared_by || resolvedName;

  // Build background: solid or gradient (linear / radial / conic)
  const baseBg = bgStyle === 'solid'
    ? bgColor1
    : undefined;

  const baseBgImage = bgStyle === 'gradient'
    ? buildGradientCss('gradient', gradientType, gradientAngle, gradientCx, gradientCy, gradientStops)
    : undefined;

  // Build overlay for when a cover image is present — re-shade each stop with
  // the overlay opacity so the image still shows through.
  const overlayEnd = overlayOpacity + 0.1 > 1 ? 1 : overlayOpacity + 0.1;
  const imageOverlay = bgStyle === 'solid'
    ? hexToRgba(bgColor1, overlayOpacity)
    : buildGradientCss(
        'gradient',
        gradientType,
        gradientAngle,
        gradientCx,
        gradientCy,
        gradientStops.map((s, i, arr) => ({
          ...s,
          color: hexToRgba(s.color, i === arr.length - 1 ? overlayEnd : overlayOpacity),
        })),
      );

  // Has prepared-by meta row? Use resolved name as fallback
  const hasPreparedByRow = showPreparedBy && preparedByName;
  // Has date row?
  const hasDateRow = showDate && proposal.cover_date;

  const animStyle: React.CSSProperties = hideButton ? {} : {
    animation: 'cover-bg-pan 15s ease-out both',
    willChange: 'transform',
  };

  return (
    <div
      className={`${hideButton ? 'w-full h-full' : 'h-dvh w-screen'} flex flex-col justify-between relative overflow-hidden transition-opacity duration-700 ${exiting ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundColor: bgColor1 }}
    >
      {!hideButton && (
        <style>{`
          @keyframes cover-bg-pan {
            from { transform: scale(1.08); }
            to   { transform: scale(1);    }
          }
        `}</style>
      )}

      {/* Background: either uploaded image or the branding bg.
          The wrapper's bgColor1 is already painted, so we fade these in
          on top of it once `loaded` flips — no flash of the viewer behind. */}
      {bgUrl ? (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: `url(${bgUrl})`, ...animStyle }}
        />
      ) : (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            backgroundColor: baseBg,
            backgroundImage: baseBgImage,
            ...animStyle,
          }}
        />
      )}

      {/* Overlay — only needed when there's a background image */}
      {bgUrl && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
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
      <div className="relative z-10 flex flex-col justify-between h-full px-6 py-6 sm:px-10 sm:py-10 md:px-16 md:py-14">
        {/* Top bar: company logo + client logo (mobile only, right-aligned) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.name}
                className="h-7 sm:h-8 md:h-10 max-w-[180px] object-contain object-left"
              />
            ) : branding.name ? (
              <div className="flex items-center gap-2">
                <Building2 size={18} style={{ color: subtitleColor }} />
                <span
                  className="text-sm font-medium tracking-wide"
                  style={{ color: textColor, opacity: 0.9, fontFamily: fontFamily(branding.font_heading) }}
                >
                  {branding.name}
                </span>
              </div>
            ) : null}
          </div>
          {/* Client logo — mobile: top right. Hidden on md+ (shown above title instead) */}
          {showClientLogo && clientLogoUrl && (
            proposal.cover_client_logo_tint_color ? (
              <div
                className="md:hidden h-7 w-[120px] opacity-90"
                style={{
                  backgroundColor: proposal.cover_client_logo_tint_color,
                  WebkitMaskImage: `url("${clientLogoUrl}")`,
                  maskImage: `url("${clientLogoUrl}")`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'right center',
                  maskPosition: 'right center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
                aria-label="Client logo"
              />
            ) : (
              <img
                src={clientLogoUrl}
                alt="Client"
                className="md:hidden h-7 max-w-[120px] object-contain opacity-90"
              />
            )
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Client logo (above title) — desktop only */}
        {showClientLogo && clientLogoUrl && (
          proposal.cover_client_logo_tint_color ? (
            <div
              className="hidden md:block h-9 md:h-10 w-[180px] mb-5 opacity-90"
              style={{
                backgroundColor: proposal.cover_client_logo_tint_color,
                WebkitMaskImage: `url("${clientLogoUrl}")`,
                maskImage: `url("${clientLogoUrl}")`,
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'left center',
                maskPosition: 'left center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
              aria-label="Client logo"
            />
          ) : (
            <img
              src={clientLogoUrl}
              alt="Client"
              className="hidden md:block h-9 md:h-10 max-w-[180px] object-contain object-left mb-5 opacity-90"
            />
          )
        )}

        {/* Title + meta + CTA */}
        <div className="max-w-2xl">
          <h1
            className="text-2xl sm:text-4xl md:text-5xl font-semibold leading-tight mb-3"
            style={{ color: textColor, fontFamily: fontFamily(branding.font_heading), fontWeight: branding.font_heading_weight || undefined }}
          >
            {proposal.title}
          </h1>

          {/* Date (directly under title) */}
          {hasDateRow && (
            <p
              className="text-xs sm:text-sm mb-2"
              style={{ color: subtitleColor, opacity: 0.7, fontFamily: fontFamily(branding.font_body) }}
            >
              {proposal.cover_date}
            </p>
          )}

          <p
            className="text-sm sm:text-base md:text-lg mb-1"
            style={{ color: subtitleColor, fontFamily: fontFamily(branding.font_body), fontWeight: branding.font_body_weight || undefined }}
          >
            {subtitle}
          </p>

          {/* Prepared-by row with optional avatar */}
          {hasPreparedByRow && (
            <div className="flex items-center gap-2.5 mb-1">
              {showAvatar && avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={preparedByName || ''}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2"
                  style={{ borderColor: `${subtitleColor}40` }}
                />
              )}
              <p
                className="text-xs sm:text-sm"
                style={{ color: subtitleColor, opacity: 0.8, fontFamily: fontFamily(branding.font_body) }}
              >
                Prepared by {preparedByName}
              </p>
            </div>
          )}

          {/* CTA button — hidden in export mode */}
          {!hideButton && (
            <>
              {/* Spacing before button */}
              <div className={hasPreparedByRow || hasDateRow ? 'mt-5' : 'mt-6'} />

              <button
                onClick={handleStart}
                className="px-8 py-3.5 text-sm font-semibold tracking-wider uppercase rounded-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                style={{
                  backgroundColor: btnBg,
                  color: btnText,
                  fontFamily: fontFamily(branding.font_heading),
                }}
              >
                {buttonText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}